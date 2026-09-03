import {
  Controller, Post, Req, Res, Body, UseGuards,
  BadRequestException, NotFoundException, RawBodyRequest,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import Stripe from 'stripe';
import { UsersService } from '../users/users.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { NotificationsService } from '../notifications/notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PLAN_CONFIG, VALID_PLANS } from '../common/plan-config';
import { Types } from 'mongoose';
import { PaymentRecord, PaymentRecordDocument } from './schemas/payment-record.schema';
import { getFrontendUrl } from '../common/url-resolver';
import { StripeSyncService } from './stripe-sync.service';
import * as jwt from 'jsonwebtoken';

const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey
  ? new Stripe(stripeKey, { apiVersion: '2025-02-24.acacia' as any })
  : null;

const PLAN_PRICE_ID = process.env.STRIPE_PRICE_PLAN || '';

const WELCOME_KIT_PRICE_ID = process.env.STRIPE_PRICE_WELCOME_KIT || '';

@ApiTags('Stripe')
@Controller('stripe')
export class StripeController {
  constructor(
    @InjectModel(PaymentRecord.name) private readonly paymentModel: Model<PaymentRecordDocument>,
    private readonly usersService: UsersService,
    private readonly subsService: SubscriptionsService,
    private readonly notifService: NotificationsService,
    private readonly syncService: StripeSyncService,
  ) {}

  // Called by the frontend after checkout success redirect to apply the session immediately,
  // without waiting for the webhook (which can be delayed or misconfigured in some envs).
  @Post('sync')
  @UseGuards(JwtAuthGuard)
  async syncCurrentUser(@Req() req: any) {
    if (!stripe) return { synced: 0 };
    const user = await this.usersService.findById(req.user.userId);
    if (!user) throw new NotFoundException('User not found.');
    const userId = (user as any)._id.toString();

    // Fetch completed sessions for this user from Stripe. A stored customer
    // ID from before a test-mode -> live-mode key switch won't exist under
    // the new key (test and live are separate Stripe namespaces) — fall back
    // to the metadata/email scan instead of letting that error bubble up.
    const scanByMetadataOrEmail = async (): Promise<Stripe.Checkout.Session[]> => {
      const list = await stripe.checkout.sessions.list({ limit: 100 });
      return list.data.filter(s =>
        s.metadata?.userId === userId ||
        s.customer_details?.email?.toLowerCase() === user.email.toLowerCase(),
      );
    };

    let sessionData: Stripe.Checkout.Session[];
    if (user.stripeCustomerId) {
      try {
        const list = await stripe.checkout.sessions.list({ customer: user.stripeCustomerId, limit: 20 });
        sessionData = list.data;
      } catch (err: any) {
        if (err?.code === 'resource_missing') {
          sessionData = await scanByMetadataOrEmail();
        } else {
          throw err;
        }
      }
    } else {
      sessionData = await scanByMetadataOrEmail();
    }

    let synced = 0;
    for (const session of sessionData) {
      if (session.status !== 'complete') continue;
      // Re-fetch user each iteration so syncedSessionIds is always fresh
      const fresh = await this.usersService.findById(userId);
      if (!fresh || (fresh.syncedSessionIds || []).includes(session.id)) continue;

      const meta = (session.metadata || {}) as Record<string, string>;
      if (meta.userId && meta.userId !== userId) continue;
      const { plan, votes, type } = meta;

      if (type === 'vote_topup' && votes) {
        const votesToAdd = parseInt(votes, 10);
        await this.usersService.update(userId, {
          boosterVotesRemaining: ((fresh as any).boosterVotesRemaining ?? 0) + votesToAdd,
          $push: { syncedSessionIds: session.id } as any,
        } as any);
        this.notifService.create({
          userId,
          type: 'votes_added',
          title: '⚡ Booster votes added!',
          message: `${votesToAdd} booster vote${votesToAdd !== 1 ? 's' : ''} added — use them anytime, no daily limit!`,
          link: '/dashboard/vote',
        }).catch(() => {});
        synced++;
        continue;
      }

      if (!plan) continue;
      const planKey = plan as keyof typeof PLAN_CONFIG;
      if (!PLAN_CONFIG[planKey]) continue;
      const addedVotes = PLAN_CONFIG[planKey].votes;
      const alreadyOnPlan = fresh.plan === planKey;
      const newVotesTotal = alreadyOnPlan ? (fresh.votesTotal ?? 0) + addedVotes : addedVotes;
      const newVotesRemaining = alreadyOnPlan ? (fresh.votesRemaining ?? 0) + addedVotes : addedVotes;

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
          userId: new Types.ObjectId(userId as string) as any,
          plan: planKey,
          amount: PLAN_CONFIG[planKey].price,
          status: 'active',
          startDate,
          endDate,
          nextBillingDate: endDate,
          stripeSubscriptionId: session.subscription as string,
        });
      }

      const addedVotesNum = addedVotes as number;
      this.notifService.create({
        userId,
        type: 'votes_added',
        title: '🗳️ Votes added to your account!',
        message: `${addedVotesNum} donation vote${addedVotesNum !== 1 ? 's' : ''} added for the ${PLAN_CONFIG[planKey].name} plan.`,
        link: '/dashboard/vote',
      }).catch(() => {});

      synced++;
    }

    return { synced };
  }

  @Post('donate-checkout')
  async donateCheckout(
    @Body() body: { amount?: number },
    @Req() req: Request,
  ) {
    if (!stripe) throw new BadRequestException('Stripe is not configured.');
    const amount = body?.amount;

    let userId = 'anonymous';
    let userEmail: string | undefined;

    const token = req.cookies?.['session'];
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
        if (decoded?.userId) {
          const user = await this.usersService.findById(decoded.userId);
          if (user) {
            userId = user._id.toString();
            userEmail = user.email;
          }
        }
      } catch (err) {
        // Ignore invalid/expired tokens, treat as anonymous
      }
    }

    const frontendUrl = getFrontendUrl();
    let lineItems: Stripe.Checkout.SessionCreateParams.LineItem[];

    if (!amount || amount <= 0) {
      // Find or create the product for custom donation
      const products = await stripe.products.list({ limit: 100 });
      let product = products.data.find(p => p.name === 'Faith Fighters Custom Donation');

      if (!product) {
        product = await stripe.products.create({
          name: 'Faith Fighters Custom Donation',
          description: 'Custom pay-what-you-want donation support.',
        });
      }

      // Find or create the price with custom_unit_amount enabled
      const prices = await stripe.prices.list({ product: product.id, limit: 100 });
      let price = prices.data.find(p => p.custom_unit_amount !== null);

      if (!price) {
        price = await stripe.prices.create({
          currency: 'usd',
          product: product.id,
          custom_unit_amount: {
            enabled: true,
          },
        });
      }

      lineItems = [
        {
          price: price.id,
          quantity: 1,
        },
      ];
    } else {
      lineItems = [
        {
          price_data: {
            currency: 'usd',
            unit_amount: Math.round(amount * 100),
            product_data: {
              name: 'Donation to Faith Fighters For America',
              description: 'Thank you for supporting our mission!',
            },
          },
          quantity: 1,
        },
      ];
    }

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: lineItems,
      metadata: {
        type: amount && amount > 0 ? 'direct_donation' : 'custom_donation',
        userId,
        ...(amount && amount > 0 ? { amount: String(amount) } : {}),
      },
      success_url: `${frontendUrl}/donation?status=success${amount && amount > 0 ? `&amount=${amount}` : ''}`,
      cancel_url: `${frontendUrl}/donation`,
    };

    if (userEmail) {
      sessionParams.customer_email = userEmail;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    return { url: session.url };
  }

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  async checkout(@Body() body: { plan: string }, @Req() req: any) {
    if (!stripe) throw new BadRequestException('Stripe is not configured.');
    const { plan } = body;
    if (!plan || !PLAN_PRICE_ID)
      throw new BadRequestException('Stripe plan price is not configured.');
    if (!VALID_PLANS.includes(plan as any))
      throw new BadRequestException('Invalid membership plan.');

    const user = await this.usersService.findById(req.user.userId);
    if (!user) throw new NotFoundException('User not found.');

    const frontendUrl = getFrontendUrl();

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      { price: PLAN_PRICE_ID, quantity: 1 },
    ];
    // Add one-time welcome kit ($24.95) for first-time subscribers
    if (!user.plan) {
      if (WELCOME_KIT_PRICE_ID) {
        lineItems.push({ price: WELCOME_KIT_PRICE_ID, quantity: 1 });
      } else {
        lineItems.push({
          price_data: {
            currency: 'usd',
            unit_amount: 2495,
            product_data: {
              name: 'Faith Builder Welcome Kit',
              description: 'One-time Welcome Kit + Setup Fee / Your Faith Fighters welcome kit, delivered to you as part of your onboarding. This one-time package includes your member items and everything you need to get started.',
              images: ['https://faithfightersforamerica.com/wp-content/uploads/2025/10/fffa-logo-new-white.png'],
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
      cancel_url: `${frontendUrl}/dashboard`,
    });
    return { url: session.url };
  }

  @SkipThrottle()
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
      const { userId, plan, votes, type, amount } = (session.metadata || {}) as { userId: string; plan: string; votes: string; type: string; amount: string };

      // ── Direct Donation ──
      if (type === 'direct_donation' && amount) {
        const parsedAmount = parseFloat(amount);
        try {
          await this.paymentModel.create({
            stripeCustomerId: session.customer as string || '',
            stripeSubscriptionId: '',
            userId: userId === 'anonymous' ? '' : userId,
            amount: parsedAmount,
            plan: 'direct_donation',
            paidAt: new Date().toISOString(),
            status: 'succeeded',
            stripeInvoiceId: session.id,
          });
        } catch (err) {
          // ignore duplicate
        }

        if (userId && userId !== 'anonymous') {
          this.notifService.create({
            userId,
            type: 'welcome',
            title: '❤️ Thank you for your support!',
            message: `We received your donation of $${parsedAmount}. Thank you for standing with us!`,
            link: '/dashboard',
          }).catch(() => {});
        }
        return res.json({ received: true });
      }

      // ── Custom Donation (Customer chooses price on Stripe page) ──
      if (type === 'custom_donation') {
        const parsedAmount = (session.amount_total ?? 0) / 100;
        try {
          await this.paymentModel.create({
            stripeCustomerId: session.customer as string || '',
            stripeSubscriptionId: '',
            userId: userId === 'anonymous' ? '' : userId,
            amount: parsedAmount,
            plan: 'custom_donation',
            paidAt: new Date().toISOString(),
            status: 'succeeded',
            stripeInvoiceId: session.id,
          });
        } catch (err) {
          // ignore duplicate
        }

        if (userId && userId !== 'anonymous') {
          this.notifService.create({
            userId,
            type: 'welcome',
            title: '❤️ Thank you for your support!',
            message: `We received your donation of $${parsedAmount}. Thank you for standing with us!`,
            link: '/dashboard',
          }).catch(() => {});
        }
        return res.json({ received: true });
      }

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
        if (!PLAN_CONFIG[planKey]) {
          return res.json({ received: true });
        }
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

  @Post('admin-sync')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Admin: run full Stripe session + renewal sync immediately' })
  async adminSync() {
    const [synced, renewed] = await Promise.all([
      this.syncService.syncUnprocessedSessions(),
      this.syncService.syncRenewals(),
    ]);
    return { synced, renewed };
  }

  @Post('backfill-payments')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Admin: backfill all historical Stripe invoices into payment_records' })
  async backfillPayments() {
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
    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: `${frontendUrl}/dashboard`,
      });
      return { url: session.url };
    } catch (err: any) {
      if (err?.code !== 'resource_missing') throw err;
      // Stale customer ID from before a test-mode -> live-mode key switch —
      // clear it so future attempts don't keep hitting the same dead record.
      await this.usersService.update((user as any)._id.toString(), { stripeCustomerId: '' } as any);
      throw new BadRequestException('No active billing profile found yet — make a purchase first to set one up.');
    }
  }
}
