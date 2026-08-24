/** Central route file: maps URL prefixes to their NestJS feature modules. */
import { Routes } from '@nestjs/core';
import { AuthModule } from '../modules/auth/auth.module';
import { ExampleModule } from '../modules/example/example.module';
import { HealthModule } from '../modules/health/health.module';
import { CrmModule } from '../modules/crm/crm.module';
import { PgModule } from '../modules/pg/pg.module';
import { SubscribersModule } from '../modules/subscribers/subscribers.module';
import { SupportModule } from '../modules/support/support.module';
import { VisitsModule } from '../modules/visits/visits.module';
import { UploadsModule } from '../modules/uploads/uploads.module';
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
    path: 'v1/pg',
    module: PgModule,
  },
  {
    path: 'v1/pg',
    module: CrmModule,
  },
  {
    path: 'v1/subscribers',
    module: SubscribersModule,
  },
  {
    path: 'v1/support',
    module: SupportModule,
  },
  {
    path: 'v1/visits',
    module: VisitsModule,
  },
  {
    path: 'v1/uploads',
    module: UploadsModule,
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
