import {
  Controller, Post, Get, Req, Res, Body, UseGuards,
  BadRequestException, NotFoundException, RawBodyRequest,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Request, Response } from 'express';
import Stripe from 'stripe';
import { UsersService } from '../users/users.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { NotificationsService } from '../notifications/notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PLAN_CONFIG } from '../common/plan-config';
import { Types } from 'mongoose';
import { PaymentRecord, PaymentRecordDocument } from './schemas/payment-record.schema';
import { getFrontendUrl } from '../common/url-resolver';

const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey
  ? new Stripe(stripeKey, { apiVersion: '2025-02-24.acacia' as any })
  : null;

const STRIPE_PRICE_IDS: Record<string, string> = {
  faith_builder: process.env.STRIPE_PRICE_FAITH_BUILDER || '',
  faith_hero:    process.env.STRIPE_PRICE_FAITH_HERO    || '',
  faith_fighter: process.env.STRIPE_PRICE_FAITH_FIGHTER || '',
};

const WELCOME_KIT_PRICE_ID = process.env.STRIPE_PRICE_WELCOME_KIT || '';

@ApiTags('Stripe')
@Controller('stripe')
export class StripeController {
  constructor(
    @InjectModel(PaymentRecord.name) private readonly paymentModel: Model<PaymentRecordDocument>,
    private readonly usersService: UsersService,
    private readonly subsService: SubscriptionsService,
    private readonly notifService: NotificationsService,
  ) {}

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  async checkout(@Body() body: { plan: string }, @Req() req: any) {
    if (!stripe) throw new BadRequestException('Stripe is not configured.');
    const { plan } = body;
    if (!plan || !STRIPE_PRICE_IDS[plan])
      throw new BadRequestException('Invalid plan.');

    const user = await this.usersService.findById(req.user.userId);
    if (!user) throw new NotFoundException('User not found.');

    const frontendUrl = getFrontendUrl();

    const planPrice = PLAN_CONFIG[plan as keyof typeof PLAN_CONFIG]?.price ?? 30;

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      { price: STRIPE_PRICE_IDS[plan], quantity: 1 },
    ];
    // Add one-time welcome kit for first-time subscribers at the same price as the plan
    if (!user.plan) {
      const welcomeKitPriceId = WELCOME_KIT_PRICE_ID;
      if (welcomeKitPriceId) {
        lineItems.push({ price: welcomeKitPriceId, quantity: 1 });
      } else {
        lineItems.push({
          price_data: {
            currency: 'usd',
            unit_amount: Math.round(planPrice * 100),
            product_data: {
              name: 'Faith Builder Welcome Kit',
              description: 'One-time Welcome Kit + Setup Fee / Your Faith Fighters welcome kit, delivered to you as part of your membership.',
            },
          },
          quantity: 1,
        });
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: user.email,
      line_items: lineItems,
      metadata: { userId: user._id.toString(), plan },
      success_url: `${frontendUrl}/dashboard?checkout=success`,
      cancel_url: `${frontendUrl}/subscribe?plan=${plan}&cancelled=true`,
    });
    return { url: session.url };
  }

  @Post('webhook')
  async webhook(@Req() req: RawBodyRequest<Request>, @Res() res: Response) {
    if (!stripe) return res.status(503).json({ error: 'Stripe not configured.' });
    const sig = req.headers['stripe-signature'] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.rawBody!, sig, webhookSecret);
    } catch {
      return res.status(400).json({ error: 'Webhook signature verification failed.' });
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const { userId, plan, votes, type } = (session.metadata || {}) as { userId: string; plan: string; votes: string; type: string };

      // ── Booster vote top-up (one-time payment, no daily limit) ──
      if (type === 'vote_topup' && userId && votes) {
        const votesToAdd = parseInt(votes, 10);
        const existingUser = await this.usersService.findById(userId);
        if (existingUser && !(existingUser.syncedSessionIds || []).includes(session.id)) {
          await this.usersService.update(userId, {
            boosterVotesRemaining: ((existingUser as any).boosterVotesRemaining ?? 0) + votesToAdd,
            $push: { syncedSessionIds: session.id } as any,
          } as any);
          this.notifService.create({
            userId,
            type: 'votes_added',
            title: '⚡ Booster votes added!',
            message: `${votesToAdd} booster vote${votesToAdd !== 1 ? 's' : ''} added — use them anytime, no daily limit!`,
            link: '/dashboard/vote',
          }).catch(() => {});
        }
        return res.json({ received: true });
      }
      if (userId && plan) {
        const planKey = plan as keyof typeof PLAN_CONFIG;
        const existingUser = await this.usersService.findById(userId);
        // Skip if user not found or session already processed (idempotency)
        if (!existingUser || (existingUser.syncedSessionIds || []).includes(session.id)) {
          return res.json({ received: true });
        }

        const addedVotes = PLAN_CONFIG[planKey].votes;
        const alreadyOnPlan = existingUser.plan === planKey;
        const newVotesTotal = alreadyOnPlan ? (existingUser.votesTotal ?? 0) + addedVotes : addedVotes;
        const newVotesRemaining = alreadyOnPlan ? (existingUser.votesRemaining ?? 0) + addedVotes : addedVotes;

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
      }
    }

    if (event.type === 'invoice.payment_succeeded') {
      const invoice = event.data.object as Stripe.Invoice;
      // Only record subscription renewal/payment invoices (not $0 setup invoices)
      const amountDollars = (invoice.amount_paid ?? 0) / 100;
      const subId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
      if (amountDollars > 0 && invoice.id) {
        // Find the plan from the subscription record
        const sub = subId ? await this.subsService.findByStripeSubscriptionId(subId) : null;
        const plan = sub?.plan ?? 'unknown';
        const userId = sub ? (sub as any).userId?.toString() : null;
        try {
          await this.paymentModel.create({
            stripeInvoiceId: invoice.id,
            stripeCustomerId: typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id ?? '',
            stripeSubscriptionId: subId ?? '',
            userId: userId ?? '',
            amount: amountDollars,
            plan,
            paidAt: new Date(invoice.status_transitions?.paid_at ? invoice.status_transitions.paid_at * 1000 : Date.now()).toISOString(),
            status: 'succeeded',
          });
        } catch {
          // Duplicate key = already recorded, ignore
        }
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as Stripe.Subscription;
      const found = await this.subsService.findByStripeSubscriptionId(sub.id);
      if (found) {
        await this.subsService.update(found._id.toString(), { status: 'cancelled' });
        await this.usersService.update(found.userId.toString(), {
          plan: undefined,
          votesRemaining: 0,
          votesTotal: 0,
          boosterVotesRemaining: 0,
        } as any);
      }
    }

    return res.json({ received: true });
  }

  @Post('backfill-payments')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Admin: backfill all historical Stripe invoices into payment_records' })
  async backfillPayments(@Req() req: any) {
    if (!stripe) throw new BadRequestException('Stripe is not configured.');

    let inserted = 0;
    let skipped = 0;
    let cursor: string | undefined;

    do {
      const invoices: Stripe.ApiList<Stripe.Invoice> = await stripe.invoices.list({
        limit: 100,
        status: 'paid',
        ...(cursor ? { starting_after: cursor } : {}),
      });

      for (const invoice of invoices.data) {
        const amountDollars = (invoice.amount_paid ?? 0) / 100;
        if (amountDollars <= 0 || !invoice.id) { skipped++; continue; }

        const subId = typeof invoice.subscription === 'string' ? invoice.subscription : (invoice.subscription as any)?.id;
        const sub = subId ? await this.subsService.findByStripeSubscriptionId(subId) : null;
        const plan = sub?.plan ?? 'unknown';
        const userId = sub ? (sub as any).userId?.toString() : '';

        try {
          await this.paymentModel.create({
            stripeInvoiceId: invoice.id,
            stripeCustomerId: typeof invoice.customer === 'string' ? invoice.customer : (invoice.customer as any)?.id ?? '',
            stripeSubscriptionId: subId ?? '',
            userId,
            amount: amountDollars,
            plan,
            paidAt: new Date(invoice.status_transitions?.paid_at ? invoice.status_transitions.paid_at * 1000 : Date.now()).toISOString(),
            status: 'succeeded',
          });
          inserted++;
        } catch {
          skipped++; // duplicate
        }
      }

      cursor = invoices.has_more ? invoices.data[invoices.data.length - 1]?.id : undefined;
    } while (cursor);

    return { inserted, skipped, total: inserted + skipped };
  }

  @Post('portal')
  @UseGuards(JwtAuthGuard)
  async portal(@Req() req: any) {
    if (!stripe) throw new BadRequestException('Stripe is not configured.');
    const user = await this.usersService.findById(req.user.userId);
    if (!user?.stripeCustomerId)
      throw new BadRequestException('No Stripe customer found.');

    const frontendUrl = getFrontendUrl();
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${frontendUrl}/dashboard`,
    });
    return { url: session.url };
  }
}
