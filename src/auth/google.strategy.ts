import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor() {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: process.env.GOOGLE_CALLBACK_URL!,
      scope: ['email', 'profile'],
      passReqToCallback: true,
    });
  }

  authenticate(req: any, options?: any) {
    // Pass the redirect param through OAuth state so we recover it on callback
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
