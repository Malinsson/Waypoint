import bcrypt from "bcrypt";
import jwt, { type SignOptions } from "jsonwebtoken";
import { Types } from "mongoose";
import { config } from "../config/env.js";
import { User } from "../models/user.js";
import { AppError } from "../utils/app-error.js";

// bcrypt cost factor: each +1 doubles the hashing time. 10 is ~100 ms,
// slow enough to hurt brute force but fast on Render's free tier.
const BCRYPT_COST = 10;

// MongoDB's error code for a unique index violation
const DUPLICATE_KEY_ERROR = 11000;

export type PublicUser = {
  id: string;
  email: string;
  displayName: string;
};

export type AuthResult = {
  token: string;
  user: PublicUser;
};

type UserFields = {
  _id: Types.ObjectId;
  email: string;
  displayName: string;
};

// The only shape a user is ever sent to the client in, so passwordHash
// cannot leak by accident
function toPublicUser(user: UserFields): PublicUser {
  return { id: user._id.toString(), email: user.email, displayName: user.displayName };
}

function signToken(userId: string): string {
  // Only the user id goes in the token. The payload is readable by anyone
  // who has the token (it is base64, not encrypted), so no personal data.
  return jwt.sign({}, config.jwtSecret, {
    subject: userId,
    // The library types only accept ms-style strings like "7d"; the value
    // comes from our own env config, so the cast is safe
    expiresIn: config.jwtExpiresIn as NonNullable<SignOptions["expiresIn"]>,
  });
}

// Returns the user id if the token is valid and not expired, otherwise null
export function verifyToken(token: string): string | null {
  try {
    // Pinning the algorithm stops a token from choosing a weaker one itself
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ["HS256"] });
    if (typeof payload === "string" || !payload.sub) return null;
    return payload.sub;
  } catch {
    return null;
  }
}

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && err.code === DUPLICATE_KEY_ERROR;
}

export async function registerUser(input: {
  email: string;
  password: string;
  displayName: string;
}): Promise<AuthResult> {
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);

  try {
    const user = await User.create({
      email: input.email,
      passwordHash,
      displayName: input.displayName,
    });
    return { token: signToken(user._id.toString()), user: toPublicUser(user) };
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw new AppError(409, "EMAIL_TAKEN", "An account with this email already exists");
    }
    throw err;
  }
}

export async function loginUser(input: { email: string; password: string }): Promise<AuthResult> {
  const user = await User.findOne({ email: input.email }).select("+passwordHash");

  // Same error for unknown email and wrong password, so the response does
  // not reveal which emails have accounts
  const passwordMatches = user ? await bcrypt.compare(input.password, user.passwordHash) : false;
  if (!user || !passwordMatches) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Wrong email or password");
  }

  return { token: signToken(user._id.toString()), user: toPublicUser(user) };
}

export async function getUserById(userId: string): Promise<PublicUser> {
  // A malformed id would make Mongoose throw a CastError (500), so treat it
  // like a missing user instead
  const user = Types.ObjectId.isValid(userId) ? await User.findById(userId) : null;
  if (!user) {
    throw new AppError(401, "UNAUTHORIZED", "Please log in again");
  }
  return toPublicUser(user);
}
