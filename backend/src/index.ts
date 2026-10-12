import { app } from "./app.js";
import { config } from "./config/env.js";
import { connectDb } from "./config/db.js";

try {
  await connectDb();
  console.log("Connected to MongoDB");
} catch (err) {
  console.error("Could not connect to MongoDB. Check MONGODB_URI and Atlas network access.");
  console.error(err);
  process.exit(1);
}

app.listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port}`);
});
