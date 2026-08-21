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
  // Exported so feature modules can protect their own routes with JwtAuthGuard.
  // JwtModule and SessionCookieService are re-exported because @UseGuards builds
  // the guard inside the consuming module's injector, so the guard's own
  // dependencies have to resolve there too.
  exports: [JwtAuthGuard, JwtModule, SessionCookieService],
})
export class AuthModule {}
