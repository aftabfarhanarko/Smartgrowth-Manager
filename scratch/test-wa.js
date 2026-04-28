
import { ensureWaClient } from "./src/lib/wp/waClient.js";
import connectDB from "./src/lib/mongodb.js";
import dotenv from "dotenv";

dotenv.config();

async function test() {
  try {
    console.log("Connecting to DB...");
    await connectDB();
    console.log("DB Connected.");

    console.log("Initializing WA Client...");
    const client = await ensureWaClient("default", true);
    console.log("WA Client Init call finished.");
    
    // Wait for ready
    console.log("Waiting for client to be ready...");
    // We can't easily wait for 'ready' here without access to the internal state
    // but ensureWaClient returns the initPromise which finishes when initialize() finishes.
    
    setTimeout(() => {
        process.exit(0);
    }, 10000);

  } catch (err) {
    console.error("Test failed:", err);
    process.exit(1);
  }
}

test();
