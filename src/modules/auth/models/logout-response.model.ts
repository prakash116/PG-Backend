import { ApiProperty } from '@nestjs/swagger';

export class LogoutResponse {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Logout successful.' })
  message!: 'Logout successful.';
}
