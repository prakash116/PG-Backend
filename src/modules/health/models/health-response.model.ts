/** Model layer: defines the data shape returned by the health endpoint. */
import { ApiProperty } from '@nestjs/swagger';

export class HealthResponse {
  @ApiProperty({ enum: ['ok'], example: 'ok' })
  status!: 'ok';

  @ApiProperty({ example: '2026-08-04T17:51:53.389Z', format: 'date-time' })
  timestamp!: string;
}
