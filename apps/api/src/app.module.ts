import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { configuration, validateEnv } from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health/health.controller';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { AuditModule } from './modules/audit/audit.module';
import { ClientsModule } from './modules/clients/clients.module';
import { OrdersModule } from './modules/orders/orders.module';
import { WmsModule } from './modules/wms/wms.module';
import { FinanceModule } from './modules/finance/finance.module';
import { FleetModule } from './modules/fleet/fleet.module';
import { ReturnsModule } from './modules/returns/returns.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from './modules/auth/guards/roles.guard';
import { PermissionsGuard } from './modules/auth/guards/permissions.guard';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    AuditModule,
    AuthModule,
    UsersModule,
    RolesModule,
    ClientsModule,
    WmsModule,
    OrdersModule,
    FinanceModule,
    FleetModule,
    ReturnsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
