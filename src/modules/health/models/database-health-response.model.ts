/** Response returned when the database connection is healthy. */
import { ApiProperty } from '@nestjs/swagger';

export class DatabaseHealthResponse {
  @ApiProperty({ enum: ['ok'], example: 'ok' })
  status!: 'ok';

  @ApiProperty({ enum: ['connected'], example: 'connected' })
  database!: 'connected';

  @ApiProperty({ example: '2026-08-04T17:51:53.389Z', format: 'date-time' })
  timestamp!: string;
}
