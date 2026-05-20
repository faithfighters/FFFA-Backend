import { Injectable, ConflictException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Response } from 'express';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { UsersService } from '../users/users.service';
import { PLAN_CONFIG, VALID_PLANS } from '../common/plan-config';

// Short-lived SSO tokens: token → { userId, role, expiresAt }
const ssoTokens = new Map<string, { userId: string; role: string; expiresAt: number }>();

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(name: string, email: string, password: string, plan: string) {
    if (!VALID_PLANS.includes(plan as any))
      throw new BadRequestException('Invalid membership plan.');
    if (password.length < 8)
      throw new BadRequestException('Password must be at least 8 characters.');

    const existing = await this.usersService.findByEmail(email);
    if (existing) throw new ConflictException('An account with this email already exists.');

    const planKey = plan as keyof typeof PLAN_CONFIG;
    const passwordHash = await bcrypt.hash(password, 12);

    const user = await this.usersService.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      role: 'member',
      plan: planKey,
      votesRemaining: PLAN_CONFIG[planKey].votes,
      votesTotal: PLAN_CONFIG[planKey].votes,
    });

    return user;
  }

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid email or password.');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid email or password.');

    return user;
  }

  signToken(userId: string, role: string): string {
    return this.jwtService.sign({ userId, role });
  }

  setSessionCookie(res: Response, token: string): void {
    res.cookie('session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  }

  clearSessionCookie(res: Response): void {
    res.clearCookie('session');
  }

  generateSsoToken(userId: string, role: string): string {
    // Purge expired tokens to prevent unbounded growth
    const now = Date.now();
    for (const [key, val] of ssoTokens) {
      if (val.expiresAt < now) ssoTokens.delete(key);
    }
    const token = randomBytes(32).toString('hex');
    ssoTokens.set(token, { userId, role, expiresAt: now + 60_000 }); // 60s TTL
    return token;
  }

  consumeSsoToken(token: string): { userId: string; role: string } | null {
    const entry = ssoTokens.get(token);
    if (!entry || entry.expiresAt < Date.now()) {
      ssoTokens.delete(token);
      return null;
    }
    ssoTokens.delete(token); // one-time use
    return { userId: entry.userId, role: entry.role };
  }
}
