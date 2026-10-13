// An error that already knows which HTTP status and error code it should
// produce. Services throw it; the central error handler turns it into JSON.
export class AppError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
  }
}
