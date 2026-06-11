import mongoose from "mongoose";
import { createClient } from "redis";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function testMongo() {
  console.log("Testing MongoDB connection to:", process.env.MONGO_URI);
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log("MongoDB connection successful!");
    await mongoose.connection.close();
    console.log("MongoDB connection closed.");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
  }
}

async function testRedis() {
  console.log("Testing Redis connection to:", process.env.REDIS_URL);
  const client = createClient({
    url: process.env.REDIS_URL,
    socket: {
      connectTimeout: 5000,
    }
  });
  client.on("error", (err) => console.error("Redis error:", err.message));
  try {
    await client.connect();
    console.log("Redis connection successful!");
    const ping = await client.ping();
    console.log("Redis PING response:", ping);
    await client.quit();
    console.log("Redis connection closed.");
  } catch (error) {
    console.error("Redis connection failed:", error.message);
  }
}

async function run() {
  await testMongo();
  await testRedis();
}

run();
