/** Central application configuration: maps environment variables to typed values. */
import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: Number.parseInt(process.env.PORT ?? '3000', 10),
}));
