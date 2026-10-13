// Adds `user` to Express's Request type so `req.user` is typed everywhere.
// It is set by the auth middleware and only contains the id from the token.
declare global {
  namespace Express {
    interface Request {
      user?: { id: string };
    }
  }
}

export {};
