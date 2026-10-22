// Imported first by tests that load config. Sets dummy values so config can
// load without a .env file. dotenv never overwrites variables that are
// already set, so a real .env cannot leak real keys into the tests.
process.env.MONGODB_URI = "mongodb://test.invalid/test";
process.env.CORS_ORIGIN = "http://localhost:5173";
process.env.JWT_SECRET = "test-secret";
process.env.GEOAPIFY_API_KEY = "test-key";
