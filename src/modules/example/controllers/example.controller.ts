/** Controller: receives GET /api/example and delegates work to the service. */
import { Controller, Get } from '@nestjs/common';
import { ExampleResponse } from '../models/example-response.model';
import { ExampleService } from '../services/example.service';

@Controller()
export class ExampleController {
  constructor(private readonly exampleService: ExampleService) {}

  /** GET action: returns a simple response that demonstrates the API flow. */
  @Get()
  getExample(): ExampleResponse {
    return this.exampleService.getExample();
  }
}
