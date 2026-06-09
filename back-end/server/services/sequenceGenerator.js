import redisClient from "../configs/redisClient.js";
import mongoose from "mongoose";
import { logger } from "../logger/logger.js";

// Mongoose model for fallback counter
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});
const Counter = mongoose.models.Counter || mongoose.model("Counter", counterSchema);

/**
 * Generates a globally ordered sequence number.
 * Attempts to use Redis INCR, falls back to MongoDB atomic counter if Redis is down.
 */
export const getNextGlobalSequence = async () => {
  try {
    if (redisClient && redisClient.isOpen) {
      // In-memory mock or real Redis client INCR
      const seq = await redisClient.incr("global:sequence");
      return Number(seq);
    }
  } catch (error) {
    logger.warn("Redis sequence generator failed, falling back to MongoDB", {
      message: error.message,
    });
  }

  // Fallback to MongoDB atomic findOneAndUpdate
  const counter = await Counter.findOneAndUpdate(
    { _id: "global:sequence" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
};
