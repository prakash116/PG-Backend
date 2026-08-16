import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '../../database/database.module';
import { AuthController } from './controllers/auth.controller';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthService } from './services/auth.service';
import { SessionCookieService } from './services/session-cookie.service';

@Module({
  imports: [
    DatabaseModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        // Matches the session cookie lifetime so both expire together.
        signOptions: {
          expiresIn: `${configService.getOrThrow<number>('app.session.maxAgeDays')}d`,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, SessionCookieService, JwtAuthGuard],
})
export class AuthModule {}
