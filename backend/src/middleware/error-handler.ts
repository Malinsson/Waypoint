import type { ErrorRequestHandler, RequestHandler } from "express";

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

  console.error(err);
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Something went wrong on the server" },
  });
};
