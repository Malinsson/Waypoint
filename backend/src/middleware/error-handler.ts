import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/app-error.js";

// Runs when no route matched the request
export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: { code: "NOT_FOUND", message: `No route for ${req.method} ${req.path}` },
  });
};

// Express recognizes an error handler by its four parameters, so `next`
// must stay in the signature even though it is only used in one branch.
export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  // If a response has already started, Express's default handler must close it
  if (res.headersSent) {
    next(err);
    return;
  }

  // express.json() throws a SyntaxError with a `body` property on malformed JSON
  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({
      error: { code: "INVALID_JSON", message: "Request body is not valid JSON" },
    });
    return;
  }

  if (err instanceof ZodError) {
    // e.g. "password: Password must be at least 8 characters"
    const message = err.issues
      .map((issue) => (issue.path.length ? `${issue.path.join(".")}: ${issue.message}` : issue.message))
      .join("; ");
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message } });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }

  // Unexpected errors: full details in the server log only, never to the client
  console.error(err);
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Something went wrong on the server" },
  });
};
