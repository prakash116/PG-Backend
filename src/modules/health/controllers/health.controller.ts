/** Controller layer: accepts health HTTP requests and returns response models. */
import { Controller, Get } from '@nestjs/common';
import { HealthResponse } from '../models/health-response.model';
import { HealthService } from '../services/health.service';

@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  getHealth(): HealthResponse {
    return this.healthService.getHealth();
  }
}
