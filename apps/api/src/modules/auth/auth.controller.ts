import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { MfaVerifyDto } from './dto/mfa-verify.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Authenticate with email + password (and TOTP if enrolled)' })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto, {
      ip: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    });
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({ summary: 'Exchange a refresh token for a new access + refresh pair' })
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke the supplied refresh token (or all if omitted)' })
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { refreshToken?: string },
  ) {
    await this.auth.logout(user.id, body.refreshToken);
  }

  @ApiBearerAuth()
  @Post('mfa/enroll')
  @ApiOperation({ summary: 'Generate a TOTP secret and otpauth URI for QR display' })
  mfaEnroll(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.mfaEnroll(user.id);
  }

  @ApiBearerAuth()
  @Post('mfa/verify')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Confirm TOTP enrolment with a generated code' })
  async mfaVerify(@CurrentUser() user: AuthenticatedUser, @Body() dto: MfaVerifyDto) {
    await this.auth.mfaVerify(user.id, dto.code);
  }
}
