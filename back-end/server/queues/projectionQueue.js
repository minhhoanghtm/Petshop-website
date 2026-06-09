import { Queue } from "bullmq";
import queueRedis from "../configs/queueRedis.js";

export const PROJECTION_QUEUE_NAME = "projectionQueue";

export const projectionQueue = new Queue(PROJECTION_QUEUE_NAME, {
  connection: queueRedis,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: true,
    removeOnFail: {
      age: 24 * 60 * 60,
    },
  },
});

export const enqueueEventForProjection = (event) => {
  return projectionQueue.add("project-event", { eventId: event._id.toString() }, {
    jobId: `proj-${event._id.toString()}` // Deduplication
  });
};

export default projectionQueue;
