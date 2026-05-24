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

  @ApiOperation({ summary: 'Start a Stripe checkout session for a plan' })
  @ApiBody({ schema: { properties: { plan: { type: 'string' } }, required: ['plan'] } })
  @ApiResponse({ status: 201, description: 'Stripe checkout URL' })
  @Post('checkout')
  async checkout(@Body() body: { plan: string }, @Req() req: any) {
    if (!stripe) throw new BadRequestException('Stripe is not configured.');
    const { plan } = body;
    if (!plan || !STRIPE_PRICE_IDS[plan]) throw new BadRequestException('Invalid plan.');

    const user = await this.usersService.findById(req.user.userId);
    if (!user) throw new NotFoundException('User not found.');

    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').split(',')[0].trim();
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: user.email,
      line_items: [{ price: STRIPE_PRICE_IDS[plan], quantity: 1 }],
      metadata: { userId: user._id.toString(), plan },
      success_url: `${frontendUrl}/dashboard?checkout=success`,
      cancel_url: `${frontendUrl}/dashboard/subscription?plan=${plan}&cancelled=true`,
    });
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
