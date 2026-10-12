import mongoose from "mongoose";
import { config } from "./env.js";

// Stored at module level so repeated calls reuse the first connection
// instead of opening a new one. This is the database singleton.
let connection: Promise<typeof mongoose> | null = null;

export function connectDb(): Promise<typeof mongoose> {
  if (!connection) {
    connection = mongoose.connect(config.mongodbUri, {
      // Fail after 10 s instead of hanging if Atlas is unreachable
      serverSelectionTimeoutMS: 10_000,
    });
  }
  return connection;
}

export function isDbConnected(): boolean {
  return mongoose.connection.readyState === mongoose.ConnectionStates.connected;
}
