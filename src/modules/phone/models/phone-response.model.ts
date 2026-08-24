import { ApiProperty } from '@nestjs/swagger';

/**
 * What the register page needs to run the MSG91 widget. Both values are
 * client-side by MSG91's design — the authkey is NOT here and never will be.
 */
export class WidgetConfigDetail {
  @ApiProperty({
    example: true,
    description: 'False until a widget id and token auth are set.',
  })
  configured!: boolean;

  @ApiProperty({ example: '3565664b4b38323831353334', nullable: true, type: String })
  widgetId!: string | null;

  @ApiProperty({ example: '123456TxxxxxxxxxxxxP1', nullable: true, type: String })
  tokenAuth!: string | null;
}

export class WidgetConfigResponse {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Widget configuration retrieved.' })
  message!: string;

  @ApiProperty({ type: WidgetConfigDetail })
  data!: WidgetConfigDetail;
}

export class PhoneVerifiedResponse {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Mobile number verified.' })
  message!: string;
}

/** The SMS account, as the settings page sees it — never the authkey. */
export class SmsSettingsDetail {
  @ApiProperty({ example: '3565664b4b38323831353334' })
  widgetId!: string;

  @ApiProperty({ example: '123456TxxxxxxxxxxxxP1' })
  tokenAuth!: string;

  @ApiProperty({
    example: true,
    description: 'Whether an authkey is stored. The authkey itself never is returned.',
  })
  hasAuthkey!: boolean;

  @ApiProperty({
    enum: ['DATABASE', 'ENVIRONMENT'],
    description:
      'ENVIRONMENT means nothing has been saved yet and the MSG91_* variables are in use.',
  })
  source!: 'DATABASE' | 'ENVIRONMENT';

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  updatedAt!: string | null;

  @ApiProperty({ example: 'Pzee Admin', nullable: true, type: String })
  updatedBy!: string | null;
}

export class SmsSettingsResponse {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'SMS settings retrieved successfully.' })
  message!: string;

  @ApiProperty({ type: SmsSettingsDetail })
  data!: SmsSettingsDetail;
}
