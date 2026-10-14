// An error that already knows which HTTP status and error code it should
// produce. Services throw it; the central error handler turns it into JSON.
export class AppError extends Error {
  status: number;
  code: string;
  // Extra machine-readable info, only where a spec asks for it
  // (e.g. which destination failed to geocode)
  details?: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    if (details) this.details = details;
  }
}
