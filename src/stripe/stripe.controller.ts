import {
  Controller, Post, Req, Res, Body, UseGuards,
  BadRequestException, NotFoundException, RawBodyRequest,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiCookieAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import Stripe from 'stripe';
import { UsersService } from '../users/users.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PLAN_CONFIG } from '../common/plan-config';
import { Types } from 'mongoose';

const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey
  ? new Stripe(stripeKey, { apiVersion: '2025-02-24.acacia' as any })
  : null;

const STRIPE_PRICE_IDS: Record<string, string> = {
  faith_builder: process.env.STRIPE_PRICE_FAITH_BUILDER || '',
  faith_hero:    process.env.STRIPE_PRICE_FAITH_HERO    || '',
  faith_fighter: process.env.STRIPE_PRICE_FAITH_FIGHTER || '',
};

@ApiTags('Stripe')
@Controller('stripe')
export class StripeController {
  constructor(
    private readonly usersService: UsersService,
    private readonly subsService: SubscriptionsService,
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

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: user.email,
      line_items: [{ price: STRIPE_PRICE_IDS[plan], quantity: 1 }],
      metadata: { userId: user._id.toString(), plan },
      success_url: `${frontendUrl}/dashboard?checkout=success`,
      cancel_url: `${frontendUrl}/join`,
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
      const { userId, plan } = (session.metadata || {}) as { userId: string; plan: string };
      if (userId && plan) {
        const planKey = plan as keyof typeof PLAN_CONFIG;
        await this.usersService.update(userId, {
          plan: planKey,
          votesRemaining: PLAN_CONFIG[planKey].votes,
          votesTotal: PLAN_CONFIG[planKey].votes,
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: session.subscription as string,
        });

        const existing = await this.subsService.findByUserId(userId);
        if (existing) {
          await this.subsService.update(existing._id.toString(), {
            plan: planKey,
            amount: PLAN_CONFIG[planKey].price,
            status: 'active',
            stripeSubscriptionId: session.subscription as string,
          });
        } else {
          await this.subsService.create({
            userId: new Types.ObjectId(userId) as any,
            plan: planKey,
            amount: PLAN_CONFIG[planKey].price,
            status: 'active',
            startDate: new Date().toISOString(),
            nextBillingDate: new Date(Date.now() + 30 * 86400000).toISOString(),
            stripeSubscriptionId: session.subscription as string,
          });
        }
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as Stripe.Subscription;
      const found = await this.subsService.findByStripeSubscriptionId(sub.id);
      if (found) await this.subsService.update(found._id.toString(), { status: 'cancelled' });
    }

    return res.json({ received: true });
  }

  @Post('portal')
  @UseGuards(JwtAuthGuard)
  async portal(@Req() req: any) {
    if (!stripe) throw new BadRequestException('Stripe is not configured.');
    const user = await this.usersService.findById(req.user.userId);
    if (!user?.stripeCustomerId)
      throw new BadRequestException('No Stripe customer found.');

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${frontendUrl}/dashboard`,
    });
    return { url: session.url };
  }
}
