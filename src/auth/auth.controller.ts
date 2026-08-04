import { Controller, Post, Get, Body, Req, Res, Query, UseGuards, HttpCode, UnauthorizedException, ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { Request, Response } from 'express';
import * as bcrypt from 'bcryptjs';
import { AuthGuard } from '@nestjs/passport';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { EmailService } from '../email/email.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiCookieAuth } from '@nestjs/swagger';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly emailService: EmailService,
  ) {}

  // 5 registrations per IP per 15 minutes — prevents account creation spam
  @Throttle({ default: { ttl: 900_000, limit: 5 } })
  @ApiOperation({ summary: 'Register a new member account (Initiate OTP)' })
  @ApiBody({ schema: { properties: { name: { type: 'string' }, email: { type: 'string' }, password: { type: 'string', minLength: 8 }, plan: { type: 'string', enum: ['faith_builder', 'faith_hero', 'faith_fighter'] }, userType: { type: 'string', enum: ['donor', 'recipient'] }, phone: { type: 'string' }, city: { type: 'string' }, helpType: { type: 'string' }, message: { type: 'string' } }, required: ['name', 'email', 'password'] } })
  @ApiResponse({ status: 200, description: 'OTP sent to email successfully' })
  @ApiResponse({ status: 400, description: 'Missing fields, invalid email format, password < 8, or invalid plan' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  @Post('register')
  @HttpCode(200)
  async register(
    @Body() body: { name: string; email: string; password: string; plan?: string; userType?: string; phone?: string; city?: string; helpType?: string; message?: string },
  ) {
    const { name, email, password, plan, userType, phone, city, helpType, message } = body;
    if (!name || !email || !password)
      throw new BadRequestException('Name, email and password are required.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new BadRequestException('Invalid email address.');
    if (password.length < 8)
      throw new BadRequestException('Password must be at least 8 characters.');
    if (userType && !['donor', 'recipient'].includes(userType))
      throw new BadRequestException('Invalid user type.');

    const { VALID_PLANS } = await import('../common/plan-config');
    if (plan && !VALID_PLANS.includes(plan as any))
      throw new BadRequestException('Invalid membership plan.');

    const existing = await this.usersService.findByEmail(email);
    if (existing) throw new ConflictException('An account with this email already exists.');

    const passwordHash = await bcrypt.hash(password, 12);
    await this.authService.generateAndSendOtp(email, 'registration', name, {
      name,
      passwordHash,
      plan,
      userType,
      phone,
      city,
      helpType,
      message,
    });

    return { success: true, message: 'Verification OTP sent to your email.' };
  }

  @Throttle({ default: { ttl: 900_000, limit: 5 } })
  @ApiOperation({ summary: 'Verify OTP and complete registration' })
  @ApiBody({ schema: { properties: { email: { type: 'string' }, code: { type: 'string', minLength: 6, maxLength: 6 } }, required: ['email', 'code'] } })
  @ApiResponse({ status: 201, description: 'Account created, session cookie set' })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
  @Post('register/verify')
  async registerVerify(
    @Body() body: { email: string; code: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { email, code } = body;
    if (!email || !code)
      throw new BadRequestException('Email and code are required.');

    const otpDoc = await this.authService.verifyOtp(email, code, 'registration');
    if (!otpDoc.registrationData) {
      throw new BadRequestException('No pending registration session found.');
    }

    const { name, passwordHash, plan, userType, phone, city, helpType, message } = otpDoc.registrationData;
    const user = await this.authService.registerWithHash(name, email, passwordHash, plan, userType, { phone, city, helpType, message });

    const token = this.authService.signToken(user._id.toString(), user.role);
    this.authService.setSessionCookie(res, token);
    
    if (plan) {
      this.emailService.sendWelcome(user.email, user.name, plan).catch(() => {});
    }

    return { user: this.usersService.sanitize(user) };
  }

  @Throttle({ default: { ttl: 900_000, limit: 5 } })
  @ApiOperation({ summary: 'Initiate forgot password OTP flow' })
  @ApiBody({ schema: { properties: { email: { type: 'string' } }, required: ['email'] } })
  @ApiResponse({ status: 200, description: 'OTP sent to email successfully' })
  @ApiResponse({ status: 400, description: 'User not found or invalid email' })
  @Post('forgot-password')
  @HttpCode(200)
  async forgotPassword(@Body() body: { email: string }) {
    const { email } = body;
    if (!email) throw new BadRequestException('Email is required.');

    const user = await this.usersService.findByEmail(email);
    if (!user) throw new BadRequestException('No account found with this email.');

    await this.authService.generateAndSendOtp(email, 'forgot_password', user.name);

    return { success: true, message: 'Password reset OTP sent to your email.' };
  }

  @Throttle({ default: { ttl: 900_000, limit: 5 } })
  @ApiOperation({ summary: 'Verify OTP and reset password' })
  @ApiBody({ schema: { properties: { email: { type: 'string' }, code: { type: 'string', minLength: 6, maxLength: 6 }, password: { type: 'string', minLength: 8 } }, required: ['email', 'code', 'password'] } })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP, password < 8' })
  @Post('forgot-password/verify')
  @HttpCode(200)
  async forgotPasswordVerify(
    @Body() body: { email: string; code: string; password?: string },
  ) {
    const { email, code, password } = body;
    if (!email || !code || !password)
      throw new BadRequestException('Email, code, and new password are required.');
    if (password.length < 8)
      throw new BadRequestException('Password must be at least 8 characters.');

    await this.authService.verifyOtp(email, code, 'forgot_password');

    const user = await this.usersService.findByEmail(email);
    if (!user) throw new NotFoundException('User not found.');

    const passwordHash = await bcrypt.hash(password, 12);
    await this.usersService.update(user._id.toString(), { passwordHash });

    return { success: true, message: 'Password has been reset successfully.' };
  }

  // 10 attempts per IP per 5 minutes — blocks brute-force while allowing normal use
  @Throttle({ default: { ttl: 300_000, limit: 10 } })
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiBody({ schema: { properties: { email: { type: 'string' }, password: { type: 'string' } }, required: ['email', 'password'] } })
  @ApiResponse({ status: 200, description: 'Login successful, session cookie set' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() body: { email: string; password: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { email, password } = body;
    if (!email || !password)
      throw new (await import('@nestjs/common')).BadRequestException('Email and password are required.');

    const user = await this.authService.login(email, password);
    const token = this.authService.signToken(user._id.toString(), user.role);
    this.authService.setSessionCookie(res, token);
    return { user: this.usersService.sanitize(user) };
  }

  @SkipThrottle()
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiCookieAuth('fffa_session')
  @ApiResponse({ status: 200, description: 'Returns current user profile' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: Request & { user: { userId: string } }) {
    const user = await this.usersService.findById(req.user.userId);
    if (!user) throw new (await import('@nestjs/common')).NotFoundException('User not found.');
    return { user: this.usersService.sanitize(user) };
  }

  @ApiOperation({ summary: 'Update current authenticated user profile' })
  @ApiCookieAuth('fffa_session')
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @UseGuards(JwtAuthGuard)
  @Post('update-profile')
  async updateProfile(
    @Req() req: Request & { user: { userId: string } },
    @Body() body: { name?: string; password?: string; currentPassword?: string; image?: string; otpCode?: string },
  ) {
    const updates: any = {};
    if (body.name) {
      updates.name = body.name.trim();
    }
    if (body.image !== undefined) {
      const trimmed = body.image.trim();
      if (trimmed && !trimmed.startsWith('https://')) {
        throw new (await import('@nestjs/common')).BadRequestException('Image URL must start with https://.');
      }
      updates.image = trimmed;
    }
    if (body.password) {
      if (body.password.length < 8) {
        throw new (await import('@nestjs/common')).BadRequestException('Password must be at least 8 characters long.');
      }
      if (!body.currentPassword) {
        throw new (await import('@nestjs/common')).BadRequestException('Current password is required to set a new password.');
      }
      const user = await this.usersService.findById(req.user.userId);
      if (!user) throw new (await import('@nestjs/common')).NotFoundException('User not found.');
      const valid = await bcrypt.compare(body.currentPassword, user.passwordHash);
      if (!valid) throw new (await import('@nestjs/common')).UnauthorizedException('Current password is incorrect.');
      
      // Verify OTP code for non-admin users
      if (user.role !== 'admin') {
        if (!body.otpCode) {
          throw new (await import('@nestjs/common')).BadRequestException('Verification code is required to set a new password.');
        }
        await this.authService.verifyOtp(user.email, body.otpCode, 'forgot_password');
      }

      updates.passwordHash = await bcrypt.hash(body.password, 12);
    }
    
    if (Object.keys(updates).length === 0) {
      throw new (await import('@nestjs/common')).BadRequestException('No update data provided.');
    }

    const updatedUser = await this.usersService.update(req.user.userId, updates);
    if (!updatedUser) throw new (await import('@nestjs/common')).NotFoundException('User not found.');
    return { user: this.usersService.sanitize(updatedUser) };
  }

  @ApiOperation({ summary: 'Logout and clear session cookie' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    this.authService.clearSessionCookie(res);
    return { success: true };
  }

  @ApiOperation({ summary: 'Generate a short-lived SSO token for the current user' })
  @ApiCookieAuth('fffa_session')
  @ApiResponse({ status: 200, description: 'Returns a one-time SSO token (valid 60s)' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @Post('sso-token')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async generateSsoToken(@Req() req: Request & { user: { userId: string; role: string } }) {
    const token = await this.authService.generateSsoToken(req.user.userId, req.user.role);
    return { token };
  }

  @ApiOperation({ summary: 'Initiate Google OAuth login' })
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleLogin() { /* redirected by passport */ }

  @ApiOperation({ summary: 'Google OAuth callback — sets session cookie and redirects' })
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: any, @Res() res: Response) {
    const { email, name, image, state: redirectState } = req.user as {
      email: string; name: string; image: string; state: string;
    };

    const allowedOrigins = [
      ...(process.env.FRONTEND_URL || 'https://stage.faithfightersforamerica.com').split(',').map(o => o.trim()),
      process.env.ADMIN_URL || 'https://stage.faithfightersforamerica.com',
      'http://localhost:3000',
      'http://localhost:3001',
    ].filter(Boolean);

    const safeRedirect = redirectState && allowedOrigins.some(o => redirectState.startsWith(o))
      ? redirectState
      : (process.env.FRONTEND_URL || 'https://stage.faithfightersforamerica.com').split(',')[0].trim();

    try {
      let user = await this.usersService.findByEmail(email);
      if (!user) {
        // New user via Google — passwordHash is a non-empty placeholder that can never
        // be used for email/password login (bcrypt.compare will always fail against it).
        user = await this.usersService.create({
          name,
          email,
          passwordHash: `google_oauth_${Date.now()}`,
          image,
          joinedAt: new Date().toISOString(),
        });
      } else if (image && !user.image) {
        await this.usersService.update(user._id.toString(), { image });
      }

      const jwt = this.authService.signToken(user._id.toString(), user.role);
      this.authService.setSessionCookie(res, jwt);
      return (res as any).redirect(safeRedirect);
    } catch (err) {
      const fallback = (process.env.FRONTEND_URL || 'https://stage.faithfightersforamerica.com').split(',')[0].trim();
      return (res as any).redirect(`${fallback}/login?error=oauth_failed`);
    }
  }

  @ApiOperation({ summary: 'Exchange SSO token for a session cookie' })
  @ApiResponse({ status: 200, description: 'Session cookie set, returns redirect URL' })
  @ApiResponse({ status: 401, description: 'Invalid or expired SSO token' })
  @Get('sso')
  async exchangeSsoToken(
    @Query('token') token: string,
    @Query('redirect') redirectUrl: string,
    @Res() res: Response,
  ) {
    const adminUrl = process.env.ADMIN_URL || 'https://stage.faithfightersforamerica.com';
    const allowedRedirectOrigins = [
      adminUrl,
      ...(process.env.FRONTEND_URL || 'https://stage.faithfightersforamerica.com').split(',').map(o => o.trim()),
      'http://localhost:3000',
      'http://localhost:3001',
    ].filter(Boolean);

    // Validate redirect URL against allowlist to prevent open redirect
    const safeRedirect = redirectUrl && allowedRedirectOrigins.some(o => redirectUrl.startsWith(o))
      ? redirectUrl
      : `${adminUrl}/admin`;

    const payload = await this.authService.consumeSsoToken(token);
    if (!payload) {
      return (res as any).redirect(`${adminUrl}/login?error=sso_expired`);
    }
    const jwt = this.authService.signToken(payload.userId, payload.role);
    this.authService.setSessionCookie(res, jwt);
    return (res as any).redirect(safeRedirect);
  }
}
