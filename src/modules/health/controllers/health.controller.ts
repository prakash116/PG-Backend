/** Controller layer: accepts health HTTP requests and returns response models. */
import { Controller, Get } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { DatabaseHealthResponse } from '../models/database-health-response.model';
import { HealthResponse } from '../models/health-response.model';
import { HealthService } from '../services/health.service';

@ApiTags('Health')
@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Check application health' })
  @ApiOkResponse({ type: HealthResponse })
  getHealth(): HealthResponse {
    return this.healthService.getHealth();
  }

  @Get('database')
  @ApiOperation({ summary: 'Check the Supabase database connection' })
  @ApiOkResponse({ type: DatabaseHealthResponse })
  @ApiServiceUnavailableResponse({ description: 'Database is unavailable' })
  getDatabaseHealth(): Promise<DatabaseHealthResponse> {
    return this.healthService.getDatabaseHealth();
  }
}
