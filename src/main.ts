/** Application entry point: configures global HTTP behavior and starts NestJS. */
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { printStartupBanner } from './common/startup-banner';

type ExpressMiddleware = (
  request: unknown,
  response: unknown,
  next: (error?: unknown) => void,
) => void;

const cookieParser = require('cookie-parser') as () => ExpressMiddleware;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.setGlobalPrefix('api');
  app.use(cookieParser());

  // Credentials must be enabled for the browser to send the session cookie.
  // An empty allowlist reflects the requesting origin, which keeps local
  // development working without configuration.
  const corsOrigins = configService.get<string[]>('app.corsOrigins', []);
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

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Pzee API')
    .setDescription('Interactive documentation for the Pzee backend API')
    .setVersion('0.1.0')
    .addTag('Health', 'Application and database health checks')
    .addTag('Example', 'Starter API examples')
    .build();
  const swaggerDocument = () =>
    SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument, {
    customSiteTitle: 'Pzee API Documentation',
    jsonDocumentUrl: 'api/docs-json',
  });

  const host = configService.get<string>('app.host', '127.0.0.1');
  const port = configService.get<number>('app.port', 3000);
  await app.listen(port, host);
  printStartupBanner(host, port);
}

void bootstrap();
