import { Queue } from "bullmq";
import queueRedis from "../configs/queueRedis.js";

export const ORDER_EXPIRY_QUEUE_NAME = "orderExpiryQueue";

export const orderExpiryQueue = new Queue(ORDER_EXPIRY_QUEUE_NAME, {
  connection: queueRedis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "fixed",
      delay: 5000,
    },
    removeOnComplete: true,
    removeOnFail: {
      age: 24 * 60 * 60,
    },
  },
});

export const enqueueOrderExpiry = (orderId, delayMs = 15 * 60 * 1000) => {
  return orderExpiryQueue.add(
    "check-order-expiry",
    { orderId },
    { delay: delayMs, jobId: `expiry-${orderId}` } // Deduplication
  );
};

export default orderExpiryQueue;
