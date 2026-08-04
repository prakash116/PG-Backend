/** Response returned when the database connection is healthy. */
export class DatabaseHealthResponse {
  status!: 'ok';
  database!: 'connected';
  timestamp!: string;
}
