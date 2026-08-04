/** Service: contains the example endpoint's response-building logic. */
import { Injectable } from '@nestjs/common';
import { ExampleResponse } from '../models/example-response.model';

@Injectable()
export class ExampleService {
  getExample(): ExampleResponse {
    return {
      message: 'API is working',
      method: 'GET',
      route: '/api/example',
    };
  }
}
