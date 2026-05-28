import {
  Controller, Get, Post, Delete, Body, Req, UseGuards,
  BadRequestException, NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiCookieAuth } from '@nestjs/swagger';
import Stripe from 'stripe';
import { SubscriptionsService } from './subscriptions.service';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PLAN_CONFIG } from '../common/plan-config';
import { Types } from 'mongoose';

const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey
  ? new Stripe(stripeKey, { apiVersion: '2025-02-24.acacia' as any })
  : null;

const STRIPE_PRICE_IDS: Record<string, string> = {
  faith_builder: process.env.STRIPE_PRICE_FAITH_BUILDER || '',
  faith_hero: process.env.STRIPE_PRICE_FAITH_HERO || '',
  faith_fighter: process.env.STRIPE_PRICE_FAITH_FIGHTER || '',
};

const WELCOME_KIT_PRICE_ID = process.env.STRIPE_PRICE_WELCOME_KIT || '';

@ApiTags('Subscription')
@ApiCookieAuth('fffa_session')
@UseGuards(JwtAuthGuard)
@Controller('subscription')
export class SubscriptionsController {
  constructor(
    private readonly subsService: SubscriptionsService,
    private readonly usersService: UsersService,
  ) {}

  @ApiOperation({ summary: 'Get current user subscription' })
  @ApiResponse({ status: 200, description: 'Current subscription or null' })
  @Get()
  async getSubscription(@Req() req: any) {
    const sub = await this.subsService.findByUserId(req.user.userId);
    return { subscription: sub || null };
  }

  @ApiOperation({ summary: 'Start a Stripe checkout or upgrade an existing subscription' })
  @ApiBody({ schema: { properties: { plan: { type: 'string' } }, required: ['plan'] } })
  @ApiResponse({ status: 201, description: 'Stripe checkout URL or { upgraded: true }' })
  @Post('checkout')
  async checkout(@Body() body: { plan: string }, @Req() req: any) {
    if (!stripe) throw new BadRequestException('Stripe is not configured.');
    const { plan } = body;
    if (!plan || !STRIPE_PRICE_IDS[plan]) throw new BadRequestException('Invalid plan.');

    const user = await this.usersService.findById(req.user.userId);
    if (!user) throw new NotFoundException('User not found.');

    // Guard: already on this plan and active
    const existingSub = await this.subsService.findActiveByUser(req.user.userId);
    if (existingSub && existingSub.plan === plan && existingSub.status === 'active') {
      throw new BadRequestException('You are already subscribed to this plan.');
    }

    // Upgrade / downgrade in-place via Stripe if user already has an active subscription
    if (existingSub?.stripeSubscriptionId && existingSub.status === 'active' && stripe) {
      const stripeSub = await stripe.subscriptions.retrieve(existingSub.stripeSubscriptionId);
      const itemId = stripeSub.items.data[0]?.id;
      if (itemId) {
        await stripe.subscriptions.update(existingSub.stripeSubscriptionId, {
          items: [{ id: itemId, price: STRIPE_PRICE_IDS[plan] }],
          proration_behavior: 'always_invoice',
          metadata: { userId: user._id.toString(), plan },
        });

        // Sync DB immediately
        const newVotes = PLAN_CONFIG[plan as keyof typeof PLAN_CONFIG]?.votes ?? 0;
        await this.subsService.update(existingSub._id.toString(), {
          plan: plan as any,
          amount: PLAN_CONFIG[plan as keyof typeof PLAN_CONFIG]?.price ?? existingSub.amount,
        });
        await this.usersService.update(req.user.userId, {
          plan: plan as any,
          votesTotal: newVotes,
          votesRemaining: newVotes,
        } as any);

        return { upgraded: true, plan };
      }
    }

    // No existing subscription — create a new Stripe Checkout session
    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').split(',')[0].trim();

    const planPrice = PLAN_CONFIG[plan as keyof typeof PLAN_CONFIG]?.price ?? 30;

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      { price: STRIPE_PRICE_IDS[plan], quantity: 1 },
    ];
    // Add one-time welcome kit for first-time subscribers at the same price as the plan
    if (!user.plan) {
      if (WELCOME_KIT_PRICE_ID) {
        lineItems.push({ price: WELCOME_KIT_PRICE_ID, quantity: 1 });
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

    // Re-use existing Stripe customer if available so card is pre-filled
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: lineItems,
      metadata: { userId: user._id.toString(), plan },
      success_url: `${frontendUrl}/dashboard?checkout=success`,
      cancel_url: `${frontendUrl}/dashboard/subscription?plan=${plan}&cancelled=true`,
    };

    if (user.stripeCustomerId) {
      sessionParams.customer = user.stripeCustomerId;
    } else {
      sessionParams.customer_email = user.email;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    return { url: session.url };
  }

  @ApiOperation({ summary: 'One-time vote top-up via Stripe checkout' })
  @ApiBody({ schema: { properties: { votes: { type: 'number' }, price: { type: 'number' }, label: { type: 'string' } }, required: ['votes', 'price'] } })
  @Post('buy-votes')
  async buyVotes(@Body() body: { votes: number; price: number; label?: string }, @Req() req: any) {
    if (!stripe) throw new BadRequestException('Stripe is not configured.');
    const { votes, price, label } = body;
    if (!votes || votes < 1 || !price || price <= 0) throw new BadRequestException('Invalid votes or price.');

    const user = await this.usersService.findById(req.user.userId);
    if (!user) throw new NotFoundException('User not found.');

    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').split(',')[0].trim();

    const sessionParams: any = {
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(price * 100),
          product_data: {
            name: label ?? `${votes} Donation Vote${votes > 1 ? 's' : ''}`,
            description: `${votes} extra donation vote${votes > 1 ? 's' : ''} added to your FFFA account.`,
          },
        },
        quantity: 1,
      }],
      metadata: { userId: user._id.toString(), votes: String(votes), type: 'vote_topup' },
      success_url: `${frontendUrl}/dashboard/subscription?votes_added=${votes}`,
      cancel_url: `${frontendUrl}/dashboard/subscription`,
    };

    if (user.stripeCustomerId) {
      sessionParams.customer = user.stripeCustomerId;
    } else {
      sessionParams.customer_email = user.email;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    return { url: session.url };
  }

  @ApiOperation({ summary: 'Cancel the current user subscription' })
  @ApiResponse({ status: 200, description: 'Subscription cancelled' })
  @Delete()
  async cancelSubscription(@Req() req: any) {
    const sub = await this.subsService.findActiveByUser(req.user.userId);
    if (!sub) throw new NotFoundException('No active subscription found.');

    if (stripe && sub.stripeSubscriptionId) {
      await stripe.subscriptions.cancel(sub.stripeSubscriptionId).catch(() => {});
    }

    await this.subsService.update(sub._id.toString(), { status: 'cancelled' });

    // Clear plan from user
    await this.usersService.update(req.user.userId, {
      plan: undefined,
      votesRemaining: 0,
      votesTotal: 0,
    } as any);

    return { success: true };
  }
}
