import type { Request, RequestHandler } from "express";
import { verifyToken } from "../services/auth-service.js";
import { AppError } from "../utils/app-error.js";

// Reads "Authorization: Bearer <token>". Anything else counts as no token.
function getUserIdFromRequest(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token ? verifyToken(token) : null;
}

// For endpoints that work for everyone. A missing, invalid, or expired token
// is not an error here: the request simply continues as a guest.
export const optionalAuth: RequestHandler = (req, _res, next) => {
  const userId = getUserIdFromRequest(req);
  if (userId) req.user = { id: userId };
  next();
};

// For endpoints that need an account. Only checks the token signature and
// expiry; it does not look the user up in the database on every request.
export const requireAuth: RequestHandler = (req, _res, next) => {
  const userId = getUserIdFromRequest(req);
  if (!userId) {
    throw new AppError(401, "UNAUTHORIZED", "You need to log in to do this");
  }
  req.user = { id: userId };
  next();
};
