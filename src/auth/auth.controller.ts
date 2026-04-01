import { Controller, Post, Get, Body, Req, Res, UseGuards, HttpCode } from '@nestjs/common';
import { Request, Response } from 'express';
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

  @ApiOperation({ summary: 'Logout and clear session cookie' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    this.authService.clearSessionCookie(res);
    return { success: true };
  }
}
