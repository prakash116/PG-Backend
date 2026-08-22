/** Root module: loads global configuration and assembles feature modules. */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, RouterModule } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import appConfig from './config/app.config';
import { AuthModule } from './modules/auth/auth.module';
import { ExampleModule } from './modules/example/example.module';
import { HealthModule } from './modules/health/health.module';
import { CrmModule } from './modules/crm/crm.module';
import { PgModule } from './modules/pg/pg.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { UsersModule } from './modules/users/users.module';
import { VisitsModule } from './modules/visits/visits.module';
import { appRoutes } from './routes/app.routes';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [appConfig],
    }),
    // A blanket limit on every route. Login and register are the ones that
    // matter: without this, nothing slows down credential stuffing.
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 10 },
      { name: 'medium', ttl: 60_000, limit: 120 },
    ]),
    RouterModule.register(appRoutes),
    AuthModule,
    ExampleModule,
    CrmModule,
    HealthModule,
    PgModule,
    UploadsModule,
    UsersModule,
    VisitsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
