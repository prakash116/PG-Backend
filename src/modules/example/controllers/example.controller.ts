/** Controller: receives GET /api/example and delegates work to the service. */
import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ExampleResponse } from '../models/example-response.model';
import { ExampleService } from '../services/example.service';

@ApiTags('Example')
@Controller()
export class ExampleController {
  constructor(private readonly exampleService: ExampleService) {}

  /** GET action: returns a simple response that demonstrates the API flow. */
  @Get()
  @ApiOperation({ summary: 'Check the starter API flow' })
  @ApiOkResponse({ type: ExampleResponse })
  getExample(): ExampleResponse {
    return this.exampleService.getExample();
  }
}
