import dotenv from "dotenv";

dotenv.config({ quiet: true });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// ES modules are evaluated only once, so every file that imports `config`
// shares this same object. That makes it the configuration singleton.
export const config = {
  port: Number(process.env.PORT ?? 3000),
  mongodbUri: requireEnv("MONGODB_URI"),
  corsOrigin: requireEnv("CORS_ORIGIN"),
};
