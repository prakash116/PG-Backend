import { ApiProperty } from '@nestjs/swagger';
import { SessionUser } from './session-response.model';

// The access token is not returned in the body: it is written to an HttpOnly
// session cookie so the browser never exposes it to JavaScript.
export class LoginDataResponse {
  @ApiProperty({ type: SessionUser })
  user!: SessionUser;
}

export class LoginResponse {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Login successful.' })
  message!: 'Login successful.';

  @ApiProperty({ type: LoginDataResponse })
  data!: LoginDataResponse;
}
