import { Controller, Post, Get, Body, Req, Res, Query, UseGuards, HttpCode, UnauthorizedException } from '@nestjs/common';
import { Request, Response } from 'express';
import * as bcrypt from 'bcryptjs';
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

  @ApiOperation({ summary: 'Register a new member account' })
  @ApiBody({ schema: { properties: { name: { type: 'string' }, email: { type: 'string' }, password: { type: 'string', minLength: 8 }, plan: { type: 'string', enum: ['faith_builder', 'faith_hero', 'faith_fighter'] } }, required: ['name', 'email', 'password', 'plan'] } })
  @ApiResponse({ status: 201, description: 'Account created, session cookie set' })
  @ApiResponse({ status: 400, description: 'Missing fields or invalid plan' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  @Post('register')
  async register(
    @Body() body: { name: string; email: string; password: string; plan: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { name, email, password, plan } = body;
    if (!name || !email || !password || !plan)
      throw new (await import('@nestjs/common')).BadRequestException('All fields are required.');

    const user = await this.authService.register(name, email, password, plan);
    const token = this.authService.signToken(user._id.toString(), user.role);
    this.authService.setSessionCookie(res, token);
    this.emailService.sendWelcome(user.email, user.name, plan).catch(() => {}); // fire-and-forget
    return { user: this.usersService.sanitize(user) };
  }

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
    @Body() body: { name?: string; password?: string; image?: string },
  ) {
    const updates: any = {};
    if (body.name) {
      updates.name = body.name.trim();
    }
    if (body.image) {
      updates.image = body.image.trim();
    }
    if (body.password) {
      if (body.password.length < 8) {
        throw new (await import('@nestjs/common')).BadRequestException('Password must be at least 8 characters long.');
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

  @ApiOperation({ summary: 'Exchange SSO token for a session cookie' })
  @ApiResponse({ status: 200, description: 'Session cookie set, returns redirect URL' })
  @ApiResponse({ status: 401, description: 'Invalid or expired SSO token' })
  @Get('sso')
  async exchangeSsoToken(
    @Query('token') token: string,
    @Query('redirect') redirectUrl: string,
    @Res() res: Response,
  ) {
    const payload = await this.authService.consumeSsoToken(token);
    if (!payload) {
      // Redirect to admin login with error if a redirect URL was given
      const adminUrl = process.env.ADMIN_URL || 'https://stage-admin.faithfightersforamerica.com';
      return (res as any).redirect(`${adminUrl}/login?error=sso_expired`);
    }
    const jwt = this.authService.signToken(payload.userId, payload.role);
    this.authService.setSessionCookie(res, jwt);
    // Redirect directly to admin dashboard — no intermediate loading page
    const destination = redirectUrl || (process.env.ADMIN_URL || 'https://stage-admin.faithfightersforamerica.com') + '/admin';
    return (res as any).redirect(destination);
  }
}
