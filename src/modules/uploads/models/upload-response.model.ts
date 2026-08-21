import { ApiProperty } from '@nestjs/swagger';

export class UploadedImage {
  @ApiProperty({
    example: 'http://127.0.0.1:5000/uploads/profile/8f2c1d.webp',
    description: 'Send this value as `profileImage` when registering.',
  })
  url!: string;
}

export class UploadImageResponse {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Image uploaded successfully.' })
  message!: 'Image uploaded successfully.';

  @ApiProperty({ type: UploadedImage })
  data!: UploadedImage;
}
