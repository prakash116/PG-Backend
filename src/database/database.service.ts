/** Shared Prisma client and database connectivity checks. */
import { PrismaPg } from '@prisma/adapter-pg';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '../generated/prisma/client';

/**
 * Reaching the Supabase pooler costs seconds on a cold connection and well under
 * a second on a reused one, so the pool is configured to hold connections open
 * across the pauses in ordinary use rather than rebuild them. See
 * `databaseConfig` in src/config/app.config.ts for the measurements behind the
 * numbers.
 */
@Injectable()
export class DatabaseService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(DatabaseService.name);

  constructor(configService: ConfigService) {
    const connectionUrl = new URL(
      configService.getOrThrow<string>('DATABASE_URL'),
    );

    // Require encrypted Supabase pooler traffic during local development.
    connectionUrl.searchParams.set('uselibpqcompat', 'true');
    connectionUrl.searchParams.set('sslmode', 'require');

    // The instance logger is not available until after super(), and these
    // callbacks are handed to the adapter before that.
    const logger = new Logger(DatabaseService.name);

    const adapter = new PrismaPg({
      connectionString: connectionUrl.toString(),
      connectionTimeoutMillis: configService.getOrThrow<number>(
        'app.database.connectionTimeoutMs',
      ),
      idleTimeoutMillis: configService.getOrThrow<number>(
        'app.database.idleTimeoutMs',
      ),
      max: configService.getOrThrow<number>('app.database.poolMax'),
      // A connection held open across a long pause is otherwise dropped
      // silently by whatever NAT sits between here and the pooler, and the
      // first query afterwards fails with "Connection terminated unexpectedly".
      keepAlive: true,
      keepAliveInitialDelayMillis: 10_000,
    },
    {
      // Without these the pool fails quietly: node-postgres reports connection
      // trouble on the pool rather than on the query, so the only visible
      // symptom was an unexplained 500.
      onConnectionError: (error: Error) => {
        logger.error(`Database connection failed: ${error.message}`);
      },
      onPoolError: (error: Error) => {
        logger.warn(`Idle database connection dropped: ${error.message}`);
      },
    });

    super({ adapter });
  }

  /**
   * Opens the first connection at startup rather than leaving it to whoever
   * happens to make the first request. Failure is logged, not thrown: a
   * database that is briefly unreachable should not stop the app from booting
   * and answering its health check.
   */
  async onModuleInit(): Promise<void> {
    const startedAt = Date.now();

    try {
      await this.$queryRaw`SELECT 1`;
      this.logger.log(`Database ready in ${Date.now() - startedAt}ms`);
    } catch (error) {
      this.logger.warn(
        `Database not reachable at startup after ${Date.now() - startedAt}ms: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async checkConnection(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      this.logger.error(
        `Database health check failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
