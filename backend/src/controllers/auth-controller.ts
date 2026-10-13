import type { Request, Response } from "express";
import { z } from "zod";
import { getUserById, loginUser, registerUser } from "../services/auth-service.js";
import { AppError } from "../utils/app-error.js";

// Normalized to lowercase here so "Anna@x.com" and "anna@x.com" are the
// same account both when registering and when logging in
const emailSchema = z
  .string("Email is required")
  .trim()
  .toLowerCase()
  .pipe(z.email("Email must be a valid email address").max(254, "Email is too long"));

const registerSchema = z.object({
  email: emailSchema,
  // bcrypt only uses the first 72 bytes, so longer passwords are rejected
  // rather than silently truncated
  password: z
    .string("Password is required")
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password must be at most 72 characters"),
  displayName: z
    .string("Display name is required")
    .trim()
    .min(1, "Display name is required")
    .max(50, "Display name must be at most 50 characters"),
});

// No length rules on login: the password is only compared, never stored
const loginSchema = z.object({
  email: emailSchema,
  password: z.string("Password is required").min(1, "Password is required"),
});

// parse() throws a ZodError on invalid input, which the error handler
// turns into 400 VALIDATION_ERROR
export async function register(req: Request, res: Response) {
  const input = registerSchema.parse(req.body);
  const result = await registerUser(input);
  res.status(201).json(result);
}

export async function login(req: Request, res: Response) {
  const input = loginSchema.parse(req.body);
  const result = await loginUser(input);
  res.json(result);
}

export async function me(req: Request, res: Response) {
  // requireAuth runs first, so this only guards against wiring mistakes
  if (!req.user) {
    throw new AppError(401, "UNAUTHORIZED", "You need to log in to do this");
  }
  const user = await getUserById(req.user.id);
  res.json({ user });
}
