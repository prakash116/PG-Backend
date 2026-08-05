import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
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
import { LoginDto } from '../models/login.dto';
import { LoginResponse } from '../models/login-response.model';
import { RegisterDto } from '../models/register.dto';
import { RegisterResponse } from '../models/register-response.model';
import { AuthService } from '../services/auth.service';

@ApiTags('Auth')
@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in with email or phone and password' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({
    description: 'Login successful.',
    type: LoginResponse,
  })
  @ApiBadRequestResponse({ description: 'Validation error.' })
  @ApiUnauthorizedResponse({ description: 'Invalid email/phone or password.' })
  @ApiForbiddenResponse({ description: 'Account is inactive or blocked.' })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error.' })
  login(@Body() loginDto: LoginDto): Promise<LoginResponse> {
    return this.authService.login(loginDto);
  }

  @Post('register')
  @ApiOperation({ summary: 'Register a user' })
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
  register(@Body() registerDto: RegisterDto): Promise<RegisterResponse> {
    return this.authService.register(registerDto);
  }
}
