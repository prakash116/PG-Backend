/** Service layer: contains the health feature's business logic. */
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import { DatabaseHealthResponse } from '../models/database-health-response.model';
import { HealthResponse } from '../models/health-response.model';

@Injectable()
export class HealthService {
  constructor(private readonly databaseService: DatabaseService) {}

  getHealth(): HealthResponse {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  async getDatabaseHealth(): Promise<DatabaseHealthResponse> {
    const connected = await this.databaseService.checkConnection();

    if (!connected) {
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'unavailable',
      });
    }

    return {
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString(),
    };
  }
}
