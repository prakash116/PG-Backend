/** Application entry point: configures global HTTP behavior and starts NestJS. */
import { join } from 'node:path';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { printStartupBanner } from './common/startup-banner';
import {
  UPLOADS_DIRECTORY,
  UPLOADS_ROUTE_PREFIX,
} from './modules/uploads/services/storage.service';

type ExpressMiddleware = (
  request: unknown,
  response: unknown,
  next: (error?: unknown) => void,
) => void;

const cookieParser = require('cookie-parser') as () => ExpressMiddleware;
const helmet = require('helmet') as (options?: unknown) => ExpressMiddleware;
const compression = require('compression') as () => ExpressMiddleware;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  const isProduction = configService.get<boolean>('app.isProduction', false);
  const corsOrigins = configService.get<string[]>('app.corsOrigins', []);

  // Render terminates TLS in front of the app. Without this, Express reads the
  // proxy's address for rate limiting and treats requests as insecure, which
  // would stop it setting the Secure session cookie.
  if (isProduction) {
    app.set('trust proxy', 1);
  }

  app.setGlobalPrefix('api');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(compression());
  app.use(cookieParser());

  // Locally stored images are served straight from disk. This is a no-op when
  // Cloudinary is configured, which it must be in production: a container's
  // filesystem is wiped on every deploy.
  app.useStaticAssets(join(process.cwd(), UPLOADS_DIRECTORY), {
    prefix: UPLOADS_ROUTE_PREFIX + '/',
  });

  /**
   * Reflecting any origin while sending credentials would let any website make
   * authenticated requests with a visitor's session cookie. That is acceptable
   * in local development, never in production, so this fails closed instead.
   */
  if (isProduction && corsOrigins.length === 0) {
    throw new Error(
      'CORS_ORIGINS must list your site origins in production, e.g. https://pzee.in,https://www.pzee.in',
    );
  }

  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );

  // Lets the platform drain connections and close the database pool on deploy.
  app.enableShutdownHooks();

  if (configService.get<boolean>('app.enableSwagger', false)) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Pzee API')
      .setDescription('Interactive documentation for the Pzee backend API')
      .setVersion('0.1.0')
      .addTag('Auth', 'Registration, login and the session cookie')
      .addTag('PG', 'A PG owner’s property')
      .addTag('Rooms', 'Rooms and their beds')
      .addTag('CRM', 'Guests, services and payments')
      .addTag('Visits', 'Visit requests from customers')
      .addTag('Uploads', 'Image uploads')
      .addTag('Health', 'Application and database health checks')
      .build();

    SwaggerModule.setup(
      'api/docs',
      app,
      () => SwaggerModule.createDocument(app, swaggerConfig),
      {
        customSiteTitle: 'Pzee API Documentation',
        jsonDocumentUrl: 'api/docs-json',
      },
    );
  }

  const host = configService.getOrThrow<string>('app.host');
  const port = configService.getOrThrow<number>('app.port');

  await app.listen(port, host);

  if (isProduction) {
    // A boxed banner is noise in a hosting provider's log stream.
    logger.log(`Pzee API listening on ${host}:${port}`);
    logger.log(`Allowed origins: ${corsOrigins.join(', ')}`);
  } else {
    printStartupBanner(host, port);
  }
}

void bootstrap();
