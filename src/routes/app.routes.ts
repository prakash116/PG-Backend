/** Central route file: maps URL prefixes to their NestJS feature modules. */
import { Routes } from '@nestjs/core';
import { AuthModule } from '../modules/auth/auth.module';
import { ExampleModule } from '../modules/example/example.module';
import { HealthModule } from '../modules/health/health.module';
import { UsersModule } from '../modules/users/users.module';

export const appRoutes: Routes = [
  {
    path: 'v1/auth',
    module: AuthModule,
  },
  {
    path: 'v1/users',
    module: UsersModule,
  },
  {
    path: 'example',
    module: ExampleModule,
  },
  {
    path: 'health',
    module: HealthModule,
  },
];
