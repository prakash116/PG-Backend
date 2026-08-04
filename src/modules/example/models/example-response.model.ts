/** Model: describes the JSON returned by the example GET endpoint. */
import { ApiProperty } from '@nestjs/swagger';

export class ExampleResponse {
  @ApiProperty({ example: 'API is working' })
  message!: string;

  @ApiProperty({ enum: ['GET'], example: 'GET' })
  method!: 'GET';

  @ApiProperty({ example: '/api/example' })
  route!: string;
}
