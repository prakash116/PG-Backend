/** Shared Prisma client and database connectivity checks. */
import { PrismaPg } from '@prisma/adapter-pg';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '../generated/prisma/client';

@Injectable()
export class DatabaseService extends PrismaClient implements OnModuleDestroy {
  constructor(configService: ConfigService) {
    const connectionUrl = new URL(
      configService.getOrThrow<string>('DATABASE_URL'),
    );

    // Require encrypted Supabase pooler traffic during local development.
    connectionUrl.searchParams.set('uselibpqcompat', 'true');
    connectionUrl.searchParams.set('sslmode', 'require');

    const adapter = new PrismaPg({
      connectionString: connectionUrl.toString(),
      connectionTimeoutMillis: 5_000,
      max: 5,
    });

    super({ adapter });
  }

  async checkConnection(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
