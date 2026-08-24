import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BlockAccountDto {
  @ApiProperty({
    example: true,
    description: 'True to block the account, false to let it back in.',
  })
  @IsBoolean({ message: 'blocked must be true or false.' })
  blocked!: boolean;
}
