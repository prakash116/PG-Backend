/** Model: describes the JSON returned by the example GET endpoint. */
export class ExampleResponse {
  message!: string;
  method!: 'GET';
  route!: string;
}
