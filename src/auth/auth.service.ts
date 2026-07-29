import { Injectable, ConflictException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Response } from 'express';
import * as bcrypt from 'bcryptjs';
import { randomBytes, randomInt } from 'crypto';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UsersService } from '../users/users.service';
import { PLAN_CONFIG, VALID_PLANS } from '../common/plan-config';
import { SsoJti, SsoJtiDocument } from './sso-jti.schema';
import { Otp, OtpDocument } from './otp.schema';
import { EmailService } from '../email/email.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
    @InjectModel(SsoJti.name) private readonly ssoJtiModel: Model<SsoJtiDocument>,
    @InjectModel(Otp.name) private readonly otpModel: Model<OtpDocument>,
  ) { }

  async register(name: string, email: string, password: string, plan?: string, userType?: string) {
    if (plan && !VALID_PLANS.includes(plan as any))
      throw new BadRequestException('Invalid membership plan.');
    if (password.length < 8)
      throw new BadRequestException('Password must be at least 8 characters.');

    const existing = await this.usersService.findByEmail(email);
    if (existing) throw new ConflictException('An account with this email already exists.');

    const passwordHash = await bcrypt.hash(password, 12);

    const createData: any = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      role: 'member',
      userType: userType === 'recipient' ? 'recipient' : 'donor',
    };

    if (plan) {
      const planKey = plan as keyof typeof PLAN_CONFIG;
      createData.plan = planKey;
      createData.votesRemaining = PLAN_CONFIG[planKey].votes;
      createData.votesTotal = PLAN_CONFIG[planKey].votes;
    }

    const user = await this.usersService.create(createData);
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

  private cookieDomain(): string | undefined {
    const env = process.env.NODE_ENV;
    if (env === 'production' || env === 'staging') return '.faithfightersforamerica.com';
    return undefined; // localhost — no domain restriction
  }

  setSessionCookie(res: Response, token: string): void {
    res.cookie('session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      domain: this.cookieDomain(),
    });
  }

  clearSessionCookie(res: Response): void {
    res.clearCookie('session', {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'lax',
      domain: this.cookieDomain(),
      path: '/',
    });
  }

  async generateSsoToken(userId: string, role: string): Promise<string> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException('User not found.');

    const jti = randomBytes(16).toString('hex');
    const payload = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      jti,
    };

    return this.jwtService.sign(payload, { expiresIn: '60s' });
  }

  async consumeSsoToken(token: string): Promise<{ userId: string; role: string } | null> {
    try {
      const payload = this.jwtService.verify(token);
      if (!payload || !payload.jti || !payload.userId) {
        return null;
      }

      // Consume JTI — only the first caller wins; replay is rejected
      const expDate = new Date(payload.exp * 1000);
      const result = await this.ssoJtiModel.updateOne(
        { jti: payload.jti },
        { $setOnInsert: { jti: payload.jti, expiresAt: expDate } },
        { upsert: true },
      );
      if (result.upsertedCount === 0) return null; // already used

      return { userId: payload.userId, role: payload.role };
    } catch (err) {
      return null; // Invalid signature or expired token
    }
  }

  async generateAndSendOtp(
    email: string,
    type: 'registration' | 'forgot_password',
    name: string,
    registrationData?: any,
  ): Promise<void> {
    const code = randomInt(100000, 999999).toString();
    const expiryMinutes = Number(process.env.OTP_EXPIRY_MINUTES) || 15;
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    await this.otpModel.updateOne(
      { email: email.toLowerCase().trim(), type },
      {
        $set: {
          code,
          expiresAt,
          registrationData,
        },
      },
      { upsert: true },
    );

    if (type === 'registration') {
      await this.emailService.sendRegisterOtp(email, name, code, expiryMinutes);
    } else if (type === 'forgot_password') {
      await this.emailService.sendForgotPasswordOtp(email, name, code, expiryMinutes);
    }
  }

  async verifyOtp(
    email: string,
    code: string,
    type: 'registration' | 'forgot_password',
  ): Promise<OtpDocument> {
    const otpDoc = await this.otpModel.findOne({
      email: email.toLowerCase().trim(),
      type,
    });

    if (!otpDoc || otpDoc.code !== code) {
      throw new BadRequestException('Invalid verification code.');
    }

    if (otpDoc.expiresAt < new Date()) {
      throw new BadRequestException('Verification code has expired.');
    }

    await this.otpModel.deleteOne({ _id: otpDoc._id });
    return otpDoc;
  }

  async registerWithHash(
    name: string,
    email: string,
    passwordHash: string,
    plan?: string,
    userType?: string,
    intake?: { phone?: string; city?: string; helpType?: string; message?: string },
  ) {
    if (plan && !VALID_PLANS.includes(plan as any))
      throw new BadRequestException('Invalid membership plan.');

    const existing = await this.usersService.findByEmail(email);
    if (existing) throw new ConflictException('An account with this email already exists.');

    const createData: any = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      role: 'member',
      userType: userType === 'recipient' ? 'recipient' : 'donor',
    };

    if (plan) {
      const planKey = plan as keyof typeof PLAN_CONFIG;
      createData.plan = planKey;
      createData.votesRemaining = PLAN_CONFIG[planKey].votes;
      createData.votesTotal = PLAN_CONFIG[planKey].votes;
    }

    if (intake?.phone) createData.phone = intake.phone.trim();
    if (intake?.city) createData.city = intake.city.trim();
    if (intake?.helpType) createData.helpType = intake.helpType.trim();
    if (intake?.message) createData.message = intake.message.trim();

    const user = await this.usersService.create(createData);
    return user;
  }
}
