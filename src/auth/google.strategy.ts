import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';

// Stateless store: passes OAuth state through without requiring express-session.
const statelessStore = {
  store(_req: any, _options: any, state: any, _meta: any, cb: Function) { cb(null, state); },
  verify(_req: any, providedState: any, cb: Function) { cb(null, true, providedState); },
};

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor() {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID || 'not-configured',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'not-configured',
      callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:4000/auth/google/callback',
      scope: ['email', 'profile'],
      passReqToCallback: true,
      store: statelessStore,
    });
  }

  authenticate(req: any, options?: any) {
    const redirect = req.query?.redirect || '';
    super.authenticate(req, { ...options, state: redirect });
  }

  async validate(
    req: any,
    _accessToken: string,
    _refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ) {
    const email: string = profile.emails?.[0]?.value?.toLowerCase() ?? '';
    const name: string = profile.displayName || profile.name?.givenName || 'User';
    const image: string = profile.photos?.[0]?.value ?? '';
    done(null, { email, name, image, state: req.query?.state ?? '' });
  }
}
