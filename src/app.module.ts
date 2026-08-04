/** Root module: loads global configuration and assembles feature modules. */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RouterModule } from '@nestjs/core';
import appConfig from './config/app.config';
import { HealthModule } from './modules/health/health.module';
import { appRoutes } from './routes/app.routes';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [appConfig],
    }),
    RouterModule.register(appRoutes),
    HealthModule,
  ],
})
export class AppModule {}
