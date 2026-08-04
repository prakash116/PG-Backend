/** Service layer: contains the health feature's business logic. */
import { Injectable } from '@nestjs/common';
import { HealthResponse } from '../models/health-response.model';

@Injectable()
export class HealthService {
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
