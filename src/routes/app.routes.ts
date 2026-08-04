/** Central route file: maps URL prefixes to their NestJS feature modules. */
import { Routes } from '@nestjs/core';
import { ExampleModule } from '../modules/example/example.module';
import { HealthModule } from '../modules/health/health.module';

export const appRoutes: Routes = [
  {
    path: 'example',
    module: ExampleModule,
  },
  {
    path: 'health',
    module: HealthModule,
  },
];
