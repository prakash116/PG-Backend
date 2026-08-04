/** Central application configuration: maps environment variables to typed values. */
import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  host: process.env.HOST ?? '127.0.0.1',
  port: Number.parseInt(process.env.PORT ?? '3000', 10),
}));
