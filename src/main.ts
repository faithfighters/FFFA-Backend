import 'reflect-metadata';
// Load .env before any module initialisation so process.env is populated
// when JwtModule.register() and other eager registrations evaluate it.
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('dotenv').config();
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { UsersService } from './users/users.service';
import { PLAN_CONFIG } from './common/plan-config';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cookieParser = require('cookie-parser');
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true, // needed for Stripe webhook signature verification
  });

  app.use(cookieParser());

const allowedOrigins = [
    // From env (comma-separated list of all allowed origins)
    ...(process.env.FRONTEND_URL || '')
      .split(',')
      .map(o => o.trim()),
    // Always allow local development origins
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    // Always allow production and staging frontends + admin panels
    'https://faithfightersforamerica.com',
    'https://www.faithfightersforamerica.com',
    'https://admin.faithfightersforamerica.com',
    'https://stage.faithfightersforamerica.com',
    'https://stage-admin.faithfightersforamerica.com',
  ].filter(Boolean);

  app.enableCors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  // ── Swagger ──────────────────────────────────────────────
  const config = new DocumentBuilder()
    .setTitle('FFFA API')
    .setDescription(
      'Faith Fighters For America — full platform API.\n\n' +
      '**Auth:** All protected endpoints require a valid `fffa_session` cookie (set automatically after login).\n\n' +
      '**Roles:** `member` · `moderator` · `admin`',
    )
    .setVersion('1.0')
    .addCookieAuth('fffa_session')
    .addTag('Auth', 'Register, login, logout, and session management')
    .addTag('Voting Cycles', 'Public voting cycle data and results')
    .addTag('Causes', 'Charity causes — public browsing and member submissions')
    .addTag('Videos', 'Video testimonials — public viewing and member submissions')
    .addTag('Leaderboard', 'Public donation and vote leaderboard')
    .addTag('Dashboard', 'Authenticated member dashboard data')
    .addTag('Votes', 'Vote casting and retrieval (authenticated members)')
    .addTag('Moderator', 'Content review — videos and campaigns (moderator/admin only)')
    .addTag('Admin', 'Full platform management (admin only)')
    .addTag('Stripe', 'Subscription checkout, webhooks, and billing portal')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
    customSiteTitle: 'FFFA API Docs',
  });

  // On every startup: fix users who have a plan but got 0 votes (OAuth signups, admin-created, etc.)
  const usersService = app.get(UsersService);
  const planVotes = Object.fromEntries(
    Object.entries(PLAN_CONFIG).map(([k, v]) => [k, v.votes])
  );
  const fixed = await usersService.fixZeroVoteUsers(planVotes);
  if (fixed > 0) console.log(`[startup] Fixed votes for ${fixed} user(s) with plan but 0 votes.`);

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`[server] FFFA NestJS backend running on http://localhost:${port}`);
  console.log(`[swagger] API docs available at http://localhost:${port}/api/docs`);
}

bootstrap();
