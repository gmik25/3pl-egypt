import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import type { JwtAccessPayload } from '../types';
import type { AuthenticatedUser } from '../../../common/types/authenticated-request';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    const secret = config.get<string>('jwt.accessSecret');
    if (!secret) throw new Error('JWT_ACCESS_SECRET not configured');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  validate(payload: JwtAccessPayload): AuthenticatedUser {
    if (payload.typ !== 'access') {
      throw new UnauthorizedException('Wrong token type');
    }
    return {
      id: payload.sub,
      email: payload.email,
      fullName: '',
      clientId: null,
      roles: payload.roles,
      permissions: payload.permissions,
      scopedGovernorates: payload.scopedGovernorates,
      mfaVerified: payload.mfa,
    };
  }
}
