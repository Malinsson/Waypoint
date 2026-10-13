import { Schema, model } from "mongoose";

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      // The unique index is what really prevents duplicates, even when two
      // registrations with the same email arrive at the same moment
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
      // Never loaded unless a query asks for it with .select("+passwordHash")
      select: false,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 50,
    },
  },
  { timestamps: true },
);

export const User = model("User", userSchema);
