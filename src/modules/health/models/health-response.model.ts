/** Model layer: defines the data shape returned by the health endpoint. */
export class HealthResponse {
  status!: 'ok';
  timestamp!: string;
}
