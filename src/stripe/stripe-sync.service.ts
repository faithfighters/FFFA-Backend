import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import Stripe from 'stripe';
import { UsersService } from '../users/users.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PLAN_CONFIG } from '../common/plan-config';
import { PaymentRecord, PaymentRecordDocument } from './schemas/payment-record.schema';

@Injectable()
export class StripeSyncService {
  private readonly logger = new Logger(StripeSyncService.name);
  private readonly stripe: Stripe | null;

  constructor(
    @InjectModel(PaymentRecord.name)
    private readonly paymentModel: Model<PaymentRecordDocument>,
    private readonly usersService: UsersService,
    private readonly subsService: SubscriptionsService,
    private readonly notifService: NotificationsService,
  ) {
    const key = process.env.STRIPE_SECRET_KEY;
    this.stripe = key
      ? new Stripe(key, { apiVersion: '2025-02-24.acacia' as any })
      : null;
  }

  // ── Run once a day at midnight ────────────────────────────
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async syncAll() {
    if (!this.stripe) return;
    this.logger.log('Starting Stripe subscription sync…');
    const synced = await this.syncUnprocessedSessions();
    const renewed = await this.syncRenewals();
    this.logger.log(`Sync complete — sessions: ${synced}, renewals: ${renewed}`);
  }

  // ── Sync any completed checkout sessions not yet in DB ────
  async syncUnprocessedSessions(): Promise<number> {
    if (!this.stripe) return 0;
    let synced = 0;
    let lastId: string | undefined;

    for (let page = 0; page < 20; page++) {
      const sessions = await this.stripe.checkout.sessions.list({
        limit: 100,
        ...(lastId ? { starting_after: lastId } : {}),
      });

      for (const session of sessions.data) {
        if (session.status !== 'complete') continue;
        const { userId, plan, votes, type } = (session.metadata || {}) as Record<string, string>;

        // Booster vote top-up
        if (type === 'vote_topup' && userId && votes) {
          const user = await this.usersService.findById(userId);
          if (user && !(user.syncedSessionIds || []).includes(session.id)) {
            const votesToAdd = parseInt(votes, 10);
            await this.usersService.update(userId, {
              boosterVotesRemaining: ((user as any).boosterVotesRemaining ?? 0) + votesToAdd,
              $push: { syncedSessionIds: session.id } as any,
            } as any);
            synced++;
          }
          continue;
        }

        // Subscription checkout
        if (!userId || !plan) continue;
        const user = await this.usersService.findById(userId);
        if (!user || (user.syncedSessionIds || []).includes(session.id)) continue;

        const planKey = plan as keyof typeof PLAN_CONFIG;
        const addedVotes = PLAN_CONFIG[planKey]?.votes ?? 0;
        const alreadyOnPlan = user.plan === planKey;
        const newVotesTotal = alreadyOnPlan ? (user.votesTotal ?? 0) + addedVotes : addedVotes;
        const newVotesRemaining = alreadyOnPlan ? (user.votesRemaining ?? 0) + addedVotes : addedVotes;

        await this.usersService.update(userId, {
          plan: planKey,
          votesRemaining: newVotesRemaining,
          votesTotal: newVotesTotal,
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: session.subscription as string,
          $push: { syncedSessionIds: session.id } as any,
        } as any);

        const existing = await this.subsService.findByUserId(userId);
        if (existing) {
          await this.subsService.update(existing._id.toString(), {
            plan: planKey,
            amount: PLAN_CONFIG[planKey].price,
            status: 'active',
            stripeSubscriptionId: session.subscription as string,
          });
        } else {
          const startDate = new Date().toISOString();
          const endDate = new Date(Date.now() + 30 * 86400000).toISOString();
          await this.subsService.create({
            userId: new Types.ObjectId(userId) as any,
            plan: planKey,
            amount: PLAN_CONFIG[planKey].price,
            status: 'active',
            startDate,
            endDate,
            nextBillingDate: endDate,
            stripeSubscriptionId: session.subscription as string,
          });
        }

        this.notifService.create({
          userId,
          type: 'votes_added',
          title: '🗳️ Votes added to your account!',
          message: `${addedVotes} donation vote${(addedVotes as number) !== 1 ? 's' : ''} added for the ${PLAN_CONFIG[planKey].name} plan.`,
          link: '/dashboard/vote',
        }).catch(() => {});

        synced++;
      }

      if (!sessions.has_more) break;
      lastId = sessions.data[sessions.data.length - 1]?.id;
    }

    return synced;
  }

  // ── Roll endDate forward on paid renewal invoices ─────────
  async syncRenewals(): Promise<number> {
    if (!this.stripe) return 0;
    let renewed = 0;
    let cursor: string | undefined;

    do {
      const invoices = await this.stripe.invoices.list({
        limit: 100,
        status: 'paid',
        ...(cursor ? { starting_after: cursor } : {}),
      });

      for (const invoice of invoices.data) {
        const amountDollars = (invoice.amount_paid ?? 0) / 100;
        if (amountDollars <= 0 || !invoice.id) continue;

        const subId =
          typeof invoice.subscription === 'string'
            ? invoice.subscription
            : (invoice.subscription as any)?.id;

        const sub = subId ? await this.subsService.findByStripeSubscriptionId(subId) : null;
        if (!sub) continue;

        // Record payment (idempotent — duplicate key is silently ignored)
        try {
          await this.paymentModel.create({
            stripeInvoiceId: invoice.id,
            stripeCustomerId:
              typeof invoice.customer === 'string'
                ? invoice.customer
                : (invoice.customer as any)?.id ?? '',
            stripeSubscriptionId: subId ?? '',
            userId: (sub as any).userId?.toString() ?? '',
            amount: amountDollars,
            plan: sub.plan,
            paidAt: new Date(
              invoice.status_transitions?.paid_at
                ? invoice.status_transitions.paid_at * 1000
                : Date.now(),
            ).toISOString(),
            status: 'succeeded',
          });
        } catch {
          // duplicate — already recorded
        }

        // Roll endDate forward: new endDate = invoice paid_at + 30 days
        const paidAt = invoice.status_transitions?.paid_at
          ? invoice.status_transitions.paid_at * 1000
          : Date.now();
        const newEndDate = new Date(paidAt + 30 * 86400000).toISOString();
        const currentEnd = (sub as any).endDate;

        if (!currentEnd || new Date(newEndDate) > new Date(currentEnd)) {
          await this.subsService.update(sub._id.toString(), {
            endDate: newEndDate,
            nextBillingDate: newEndDate,
            status: 'active',
          } as any);
          renewed++;
        }
      }

      cursor = invoices.has_more
        ? invoices.data[invoices.data.length - 1]?.id
        : undefined;
    } while (cursor);

    return renewed;
  }
}
