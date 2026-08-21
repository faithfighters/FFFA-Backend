import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { Request } from 'express';
import { UsersService } from '../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly usersService: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => {
          return req?.cookies?.['session'] ?? null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET!,
      algorithms: ['HS256'],
    });
  }

  async validate(payload: { userId: string; role: string }) {
    if (!payload?.userId) throw new UnauthorizedException();
    const user = await this.usersService.findById(payload.userId);
    if (!user || user.isActive === false) throw new UnauthorizedException();
    return { userId: payload.userId, role: payload.role };
  }
}
