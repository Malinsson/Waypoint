// Thrown by the Geoapify Facade. It says what kind of problem happened
// without exposing anything about Geoapify; the error handler decides the
// HTTP status and the message the user sees.
export type UpstreamErrorKind = "NO_ROUTE" | "RATE_LIMITED" | "UNAVAILABLE";

export class UpstreamError extends Error {
  kind: UpstreamErrorKind;

  // `message` is for the server log only and is never sent to the client
  constructor(kind: UpstreamErrorKind, message: string) {
    super(message);
    this.name = "UpstreamError";
    this.kind = kind;
  }
}
