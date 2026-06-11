import { Worker } from "bullmq";
import queueRedis from "../configs/queueRedis.js";
import redisClient from "../configs/redisClient.js";
import EventStore from "../models/EventStore.js";
import ProjectionCheckpoint from "../models/ProjectionCheckpoint.js";
import { projectOrder, projectProductStockEvent, projectPaymentEvent } from "../services/projector.js";
import { logger } from "../logger/logger.js";
import { PROJECTION_QUEUE_NAME } from "../queues/projectionQueue.js";

/**
 * Synchronizes and repairs database checkpoints and Redis global sequence.
 * This heals any sequence mismatches if Redis is cleared or restarted.
 */
export const syncSequencesAndCheckpoints = async () => {
  logger.info("[SequenceSync] Starting sequence and checkpoint synchronization...");
  try {
    const aggregateTypes = ["Order", "Product"];
    
    // 1. Sync and repair Projection Checkpoints
    for (const type of aggregateTypes) {
      const maxEvent = await EventStore.findOne({ aggregateType: type })
        .sort({ globalSequence: -1 });
      
      const maxEventSeq = maxEvent ? maxEvent.globalSequence : 0;
      const checkpoint = await ProjectionCheckpoint.findOne({ aggregateType: type });
      
      if (checkpoint && checkpoint.lastProcessedGlobalSequence > maxEventSeq) {
        logger.warn(`[SequenceSync] Checkpoint mismatch for ${type}: checkpoint (${checkpoint.lastProcessedGlobalSequence}) is greater than max event sequence (${maxEventSeq}). Resetting checkpoint to 0 to rebuild projection.`);
        await ProjectionCheckpoint.updateOne(
          { aggregateType: type },
          { $set: { lastProcessedGlobalSequence: 0 } }
        );
      }
    }

    // 2. Sync Redis global:sequence
    const maxEventGlobal = await EventStore.findOne().sort({ globalSequence: -1 });
    const maxDbSeq = maxEventGlobal ? maxEventGlobal.globalSequence : 0;

    const maxCheckpoints = await ProjectionCheckpoint.find({});
    const maxCheckpointSeq = maxCheckpoints.reduce((max, c) => Math.max(max, c.lastProcessedGlobalSequence), 0);

    const requiredSeq = Math.max(maxDbSeq, maxCheckpointSeq);

    if (redisClient && redisClient.isOpen) {
      const redisSeqRaw = await redisClient.get("global:sequence");
      const redisSeq = redisSeqRaw ? Number(redisSeqRaw) : 0;

      if (redisSeq < requiredSeq) {
        logger.warn(`[SequenceSync] Redis sequence (${redisSeq}) is behind database max sequence (${requiredSeq}). Fast-forwarding Redis sequence key.`);
        await redisClient.set("global:sequence", requiredSeq);
      }
    }
    logger.info("[SequenceSync] Sequence and checkpoint synchronization completed successfully.");
  } catch (error) {
    logger.error("[SequenceSync] Error during sequence and checkpoint synchronization:", error);
  }
};

/**
 * Resumes projections from the last saved global sequence checkpoint for each aggregate type.
 * Ensures the system catches up on missed events after a crash or restart.
 */
export const resumeProjectionsFromCheckpoints = async () => {
  logger.info("[ProjectionWorker] Checking for pending events to catch up from checkpoints...");
  
  // Align and repair sequences and checkpoints
  await syncSequencesAndCheckpoints();

  const checkpoints = await ProjectionCheckpoint.find({});
  const aggregateTypes = ["Order", "Product"];

  for (const type of aggregateTypes) {
    const checkpoint = checkpoints.find((c) => c.aggregateType === type);
    const lastSeq = checkpoint ? checkpoint.lastProcessedGlobalSequence : 0;

    const pendingEvents = await EventStore.find({
      aggregateType: type,
      globalSequence: { $gt: lastSeq },
    }).sort({ globalSequence: 1 });

    if (pendingEvents.length > 0) {
      logger.info(`[ProjectionWorker] Catching up ${type} projections from sequence ${lastSeq}. Found ${pendingEvents.length} events.`);
      for (const event of pendingEvents) {
        try {
          if (type === "Order") {
            await projectOrder(event.aggregateId);
            if (["PaymentReceived", "PaymentRefundFlagged"].includes(event.eventType)) {
              await projectPaymentEvent(event);
            }
          } else if (type === "Product") {
            await projectProductStockEvent(event);
          }

          // Update checkpoint atomically
          await ProjectionCheckpoint.updateOne(
            { aggregateType: type },
            { $set: { lastProcessedGlobalSequence: event.globalSequence } },
            { upsert: true }
          );
        } catch (err) {
          logger.error(`[ProjectionWorker] Failed to process event ${event._id} during catch-up:`, err);
          break; // Halt catch-up for this aggregate type to maintain causal ordering
        }
      }
    }
  }
  logger.info("[ProjectionWorker] Catch-up check completed.");
};

export const startProjectionWorker = () => {
  // Trigger catch-up asynchronously on startup
  resumeProjectionsFromCheckpoints().catch((err) => {
    logger.error("[ProjectionWorker] Error running catch-up on startup:", err);
  });

  const worker = new Worker(
    PROJECTION_QUEUE_NAME,
    async (job) => {
      const { eventId } = job.data;
      
      const event = await EventStore.findById(eventId);
      if (!event) {
        logger.warn(`[ProjectionWorker] Event not found: ${eventId}`);
        return;
      }

      // 1. Ignore event if sequence is <= checkpoint (Idempotency check)
      const checkpoint = await ProjectionCheckpoint.findOne({ aggregateType: event.aggregateType });
      if (checkpoint && event.globalSequence <= checkpoint.lastProcessedGlobalSequence) {
        logger.info(`[ProjectionWorker] Ignoring event ${event.eventType} (Seq: ${event.globalSequence}) because it has already been processed (Checkpoint: ${checkpoint.lastProcessedGlobalSequence})`);
        return;
      }

      logger.info(`[ProjectionWorker] Processing event ${event.eventType} (Seq: ${event.globalSequence}) for Aggregate: ${event.aggregateId}`);

      // 2. Execute projection
      if (event.aggregateType === "Order") {
        await projectOrder(event.aggregateId);
        if (["PaymentReceived", "PaymentRefundFlagged"].includes(event.eventType)) {
          await projectPaymentEvent(event);
        }
      } else if (event.aggregateType === "Product") {
        await projectProductStockEvent(event);
      }

      // 3. Atomically update checkpoint
      await ProjectionCheckpoint.updateOne(
        { 
          aggregateType: event.aggregateType,
          $or: [
            { lastProcessedGlobalSequence: { $lt: event.globalSequence } },
            { lastProcessedGlobalSequence: { $exists: false } }
          ]
        },
        { $set: { lastProcessedGlobalSequence: event.globalSequence } },
        { upsert: true }
      );
    },
    { connection: queueRedis }
  );

  worker.on("failed", (job, err) => {
    logger.error(`[ProjectionWorker] Job failed for event ${job?.data?.eventId}:`, err);
  });

  return worker;
};
export default startProjectionWorker;
