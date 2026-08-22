import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import {
  AuthenticatedRequest,
  JwtAuthGuard,
} from '../guards/jwt-auth.guard';
import { LoginDto } from '../models/login.dto';
import { LoginResponse } from '../models/login-response.model';
import { LogoutResponse } from '../models/logout-response.model';
import { RegisterDto } from '../models/register.dto';
import { RegisterResponse } from '../models/register-response.model';
import { SessionResponse } from '../models/session-response.model';
import { AuthService } from '../services/auth.service';
import { SessionCookieService } from '../services/session-cookie.service';

@ApiTags('Auth')
@Controller()
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionCookieService: SessionCookieService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  // Ten attempts a minute per address: enough for a forgetful person,
  // useless for guessing passwords.
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({
    summary: 'Log in with email or phone and password',
    description:
      'On success the JWT is written to an HttpOnly session cookie valid for 30 days.',
  })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({
    description: 'Login successful.',
    type: LoginResponse,
  })
  @ApiBadRequestResponse({ description: 'Validation error.' })
  @ApiUnauthorizedResponse({ description: 'Invalid email/phone or password.' })
  @ApiForbiddenResponse({ description: 'Account is inactive or blocked.' })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error.' })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponse> {
    const { tokenPayload, body } = await this.authService.login(loginDto);
    await this.sessionCookieService.issue(response, tokenPayload);
    return body;
  }

  @Post('register')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({
    summary: 'Register a PG seeker or a PG owner',
    description:
      'One endpoint for both roles. USER requires address and dateOfBirth; PG_OWNER requires pgName and pgLocation and receives a unique PG code. The session cookie is issued on success, so the new account is signed in.',
  })
  @ApiBody({ type: RegisterDto })
  @ApiCreatedResponse({
    description: 'Registration successful.',
    type: RegisterResponse,
  })
  @ApiBadRequestResponse({ description: 'Validation error.' })
  @ApiConflictResponse({
    description: 'Email or phone already exists.',
  })
  @ApiForbiddenResponse({
    description: 'Super Admin registration is not allowed.',
  })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error.' })
  async register(
    @Body() registerDto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RegisterResponse> {
    const { tokenPayload, body } = await this.authService.register(registerDto);
    await this.sessionCookieService.issue(response, tokenPayload);
    return body;
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Read the signed-in user from the session cookie',
    description:
      'Extends the session cookie by another 30 days, so an active user is never signed out.',
  })
  @ApiOkResponse({ description: 'Session is active.', type: SessionResponse })
  @ApiUnauthorizedResponse({ description: 'Session is missing or expired.' })
  @ApiForbiddenResponse({ description: 'Account is inactive or blocked.' })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error.' })
  async getSession(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SessionResponse> {
    const user = request.sessionUser;
    await this.sessionCookieService.issue(response, {
      sub: user.id,
      role: user.role,
    });

    return {
      success: true,
      message: 'Session is active.',
      data: user,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log out and clear the session cookie' })
  @ApiOkResponse({ description: 'Logout successful.', type: LogoutResponse })
  logout(@Res({ passthrough: true }) response: Response): LogoutResponse {
    this.sessionCookieService.clear(response);

    return {
      success: true,
      message: 'Logout successful.',
    };
  }
}
