import { Worker } from "bullmq";
import mongoose from "mongoose";
import queueRedis from "../configs/queueRedis.js";
import EventStore from "../models/EventStore.js";
import { getNextGlobalSequence } from "../services/sequenceGenerator.js";
import { enqueueEventForProjection } from "../queues/projectionQueue.js";
import { logger } from "../logger/logger.js";
import { ORDER_EXPIRY_QUEUE_NAME } from "../queues/orderExpiryQueue.js";

export const startOrderExpiryWorker = () => {
  const worker = new Worker(
    ORDER_EXPIRY_QUEUE_NAME,
    async (job) => {
      const { orderId } = job.data;
      logger.info(`[OrderExpiryWorker] Checking expiry for order: ${orderId}`);

      const session = await mongoose.startSession();
      let newEvents = [];

      try {
        await session.withTransaction(async () => {
          newEvents = [];
          
          const events = await EventStore.find({ aggregateId: orderId }).session(session);
          if (events.length === 0) {
            logger.warn(`[OrderExpiryWorker] Event stream not found for order ${orderId}`);
            return;
          }

          // Check if already paid or cancelled
          const hasPayment = events.some((e) => e.eventType === "PaymentReceived");
          const hasCancellation = events.some((e) => e.eventType === "OrderCancelled");

          if (hasPayment || hasCancellation) {
            logger.info(`[OrderExpiryWorker] Order ${orderId} already processed (Paid: ${hasPayment}, Cancelled: ${hasCancellation}). Ignoring.`);
            return;
          }

          const orderPlacedEvent = events.find((e) => e.eventType === "OrderPlaced");
          if (!orderPlacedEvent) {
            logger.error(`[OrderExpiryWorker] OrderPlaced event not found for order ${orderId}`);
            return;
          }

          const correlationId = orderPlacedEvent.correlationId;
          const items = orderPlacedEvent.payload.items;
          const latestOrderEvent = events[events.length - 1];
          const nextOrderVersion = latestOrderEvent.version + 1;

          // Append OrderCancelled event
          const seqOrderCancelled = await getNextGlobalSequence();
          const orderCancelledEvent = new EventStore({
            aggregateId: orderId,
            aggregateType: "Order",
            version: nextOrderVersion,
            eventType: "OrderCancelled",
            globalSequence: seqOrderCancelled,
            correlationId,
            causationId: job.id || "system",
            payload: { orderId },
          });
          await orderCancelledEvent.save({ session });
          newEvents.push(orderCancelledEvent);

          // Append StockReleased events for all items in the order
          for (const item of items) {
            const latestProductEvent = await EventStore.findOne({ aggregateId: item.product_id })
              .sort({ version: -1 })
              .session(session);
            const nextProductVersion = latestProductEvent ? latestProductEvent.version + 1 : 1;

            const seqStockReleased = await getNextGlobalSequence();
            const stockReleasedEvent = new EventStore({
              aggregateId: item.product_id,
              aggregateType: "Product",
              version: nextProductVersion,
              eventType: "StockReleased",
              globalSequence: seqStockReleased,
              correlationId,
              causationId: orderCancelledEvent._id.toString(),
              payload: { productId: item.product_id, quantity: item.quantity, orderId },
            });
            await stockReleasedEvent.save({ session });
            newEvents.push(stockReleasedEvent);
          }
        });
      } finally {
        session.endSession();
      }

      // Enqueue projection jobs asynchronously outside of the database transaction
      for (const event of newEvents) {
        await enqueueEventForProjection(event);
      }
    },
    { connection: queueRedis }
  );

  worker.on("failed", (job, err) => {
    logger.error(`[OrderExpiryWorker] Job failed for order ${job?.data?.orderId}:`, err);
  });

  return worker;
};
export default startOrderExpiryWorker;
