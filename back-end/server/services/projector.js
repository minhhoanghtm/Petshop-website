import Order from "../models/Order.js";
import Product from "../models/Product.js";
import Payment from "../models/Payment.js";
import EventStore from "../models/EventStore.js";
import ProjectionCheckpoint from "../models/ProjectionCheckpoint.js";
import { logger } from "../logger/logger.js";

/**
 * Projects the current state of an Order based on all its events,
 * applying deterministic priority rules: PaymentReceived > OrderCancelled > OrderPlaced.
 */
export const projectOrder = async (orderId, session = null) => {
  const query = EventStore.find({ aggregateId: orderId }).sort({ version: 1 });
  if (session) query.session(session);
  const events = await query;

  if (events.length === 0) return;

  const latestEvent = events[events.length - 1];
  const orderPlacedEvent = events.find((e) => e.eventType === "OrderPlaced");

  let baseOrderData = {};
  let status = "pending";
  let payment_status = "pending";

  if (!orderPlacedEvent) {
    // Legacy support: if OrderPlaced event is missing, read base data from the existing MongoDB document
    const existingOrderQuery = Order.findById(orderId);
    if (session) existingOrderQuery.session(session);
    const existingOrder = await existingOrderQuery;

    if (!existingOrder) {
      logger.warn(`OrderPlaced event not found and Order document not found in DB for order ${orderId}`);
      return;
    }

    baseOrderData = {
      user_id: existingOrder.user_id,
      items: existingOrder.items,
      total_price: existingOrder.total_price,
      payment_method: existingOrder.payment_method,
      fullName: existingOrder.fullName,
      email: existingOrder.email,
      phone: existingOrder.phone,
      address: existingOrder.address,
      province: existingOrder.province,
      district: existingOrder.district,
      ward: existingOrder.ward,
      detailAddress: existingOrder.detailAddress,
      deliveryOption: existingOrder.deliveryOption,
      shippingCost: existingOrder.shippingCost,
    };
    // Initialize status and payment_status from the existing order doc
    status = existingOrder.status || "pending";
    payment_status = existingOrder.payment_status || "pending";
  } else {
    const payload = orderPlacedEvent.payload;
    baseOrderData = {
      user_id: payload.user_id,
      items: payload.items,
      total_price: payload.total_price,
      payment_method: payload.payment_method,
      fullName: payload.fullName,
      email: payload.email,
      phone: payload.phone,
      address: payload.address,
      province: payload.province,
      district: payload.district,
      ward: payload.ward,
      detailAddress: payload.detailAddress,
      deliveryOption: payload.deliveryOption || "delivery",
      shippingCost: payload.shippingCost || 0,
      voucher_id: payload.voucher_id || null,
      discount_amount: payload.discount_amount || 0,
    };
  }

  // Play events sequentially to determine final state
  for (const event of events) {
    switch (event.eventType) {
      case "OrderPlaced":
        status = "pending";
        payment_status = "pending";
        break;
      case "PaymentReceived":
        if (status === "cancelled") {
          payment_status = "refunded";
        } else {
          payment_status = "paid";
          if (status === "pending") {
            status = "confirmed";
          }
        }
        break;
      case "OrderStatusChanged":
        status = event.payload.newStatus || status;
        break;
      case "OrderCancelled":
        status = "cancelled";
        payment_status = payment_status === "paid" ? "refunded" : "failed";
        break;
      case "OrderDelivered":
        status = "delivered";
        payment_status = "paid";
        break;
      default:
        break;
    }
  }

  const updateData = {
    ...baseOrderData,
    status,
    payment_status,
    lastEventSequence: latestEvent.globalSequence,
    updatedAt: new Date(),
  };

  const updateQuery = Order.updateOne(
    {
      _id: orderId,
      $or: [
        { lastEventSequence: { $lt: latestEvent.globalSequence } },
        { lastEventSequence: { $exists: false } },
      ],
    },
    { $set: updateData },
    { upsert: true }
  );

  if (session) updateQuery.session(session);
  await updateQuery;
  logger.info(`Projected Order ${orderId} successfully to status: ${status}, payment_status: ${payment_status}`);
};

/**
 * Projects a Product stock update event, enforcing idempotency and the rule
 * that StockReleased events are ignored if the corresponding order is paid.
 */
export const projectProductStockEvent = async (event, session = null) => {
  const { productId, quantity, orderId } = event.payload;

  if (event.eventType === "StockReserved") {
    const updateQuery = Product.updateOne(
      {
        _id: productId,
        $or: [
          { lastEventSequence: { $lt: event.globalSequence } },
          { lastEventSequence: { $exists: false } },
        ],
      },
      {
        $inc: { stock: -quantity },
        $set: { lastEventSequence: event.globalSequence },
      }
    );

    if (session) updateQuery.session(session);
    const result = await updateQuery;
    if (result.modifiedCount > 0) {
      logger.info(`Projected StockReserved: Decremented ${quantity} from product ${productId}`);
    }
  } else if (event.eventType === "StockReleased") {
    // Conflict resolution rule: check if the order has been paid
    const paymentQuery = EventStore.findOne({
      aggregateId: orderId,
      eventType: "PaymentReceived",
    });

    if (session) paymentQuery.session(session);
    const hasPayment = await paymentQuery;

    if (hasPayment) {
      logger.info(`Ignoring StockReleased event for product ${productId} because order ${orderId} is paid.`);
      return;
    }

    const updateQuery = Product.updateOne(
      {
        _id: productId,
        $or: [
          { lastEventSequence: { $lt: event.globalSequence } },
          { lastEventSequence: { $exists: false } },
        ],
      },
      {
        $inc: { stock: quantity },
        $set: { lastEventSequence: event.globalSequence },
      }
    );

    if (session) updateQuery.session(session);
    const result = await updateQuery;
    if (result.modifiedCount > 0) {
      logger.info(`Projected StockReleased: Incremented ${quantity} to product ${productId}`);
    }
  }
};

/**
 * Projects a Payment event, mapping it to paid or failed states idempotently.
 */
export const projectPaymentEvent = async (event, session = null) => {
  const { orderId, txnId, amount, method, rawPayload } = event.payload;

  if (event.eventType === "PaymentReceived") {
    const updateQuery = Payment.updateOne(
      { order_id: orderId, method },
      {
        $set: {
          status: "paid",
          provider_transaction_id: txnId,
          provider_response: rawPayload,
          paid_at: new Date(),
        }
      }
    );
    if (session) updateQuery.session(session);
    await updateQuery;
    logger.info(`Projected PaymentReceived: Set status paid for order ${orderId}`);
  } else if (event.eventType === "PaymentRefundFlagged") {
    const updateQuery = Payment.updateOne(
      { order_id: orderId, method },
      {
        $set: {
          status: "failed", // Flag as failed / requires refund
          provider_transaction_id: txnId,
          provider_response: { note: "Payment received after order was cancelled/expired", raw: rawPayload },
        }
      }
    );
    if (session) updateQuery.session(session);
    await updateQuery;
    logger.info(`Projected PaymentRefundFlagged: Set status failed (requires refund) for order ${orderId}`);
  }
};

/**
 * Rebuilds the projections for a specific aggregateType deterministically by:
 * 1. Clearing/resetting the read model projections.
 * 2. Replaying all events from the Event Store in globalSequence ASC order.
 * 3. Atomic checkpoint update.
 */
export const rebuildProjection = async (aggregateType) => {
  logger.info(`[Projector] Starting deterministic rebuild for aggregateType: ${aggregateType}`);

  if (aggregateType === "Order") {
    // 1. Clear projections
    await Order.deleteMany({});
    await Payment.deleteMany({});
    logger.info("[Projector] Cleared Orders and Payments projection collections.");

    // 2. Fetch all events for Order ordered by globalSequence ASC
    const events = await EventStore.find({ aggregateType: "Order" }).sort({ globalSequence: 1 });
    logger.info(`[Projector] Replaying ${events.length} Order events...`);

    let lastSeq = 0;
    const processedOrderIds = new Set();

    // 3. Replay deterministically
    for (const event of events) {
      const orderId = event.aggregateId;
      if (!processedOrderIds.has(orderId)) {
        await projectOrder(orderId);
        processedOrderIds.add(orderId);
      }

      if (["PaymentReceived", "PaymentRefundFlagged"].includes(event.eventType)) {
        await projectPaymentEvent(event);
      }

      lastSeq = Math.max(lastSeq, event.globalSequence);
    }

    // 4. Update checkpoint
    await ProjectionCheckpoint.updateOne(
      { aggregateType: "Order" },
      { $set: { lastProcessedGlobalSequence: lastSeq } },
      { upsert: true }
    );
    logger.info(`[Projector] Rebuild completed for Order. Checkpoint set to globalSequence: ${lastSeq}`);

  } else if (aggregateType === "Product") {
    // 1. Reset Product stock projection to baseStock without deleting admin-created product details
    // If baseStock is not set, initialize it with current stock
    await Product.updateMany({ baseStock: { $exists: false } }, [
      { $set: { baseStock: "$stock" } },
    ]);
    // Reset stock to baseStock
    await Product.updateMany({}, [
      { $set: { stock: "$baseStock" } },
    ]);
    logger.info("[Projector] Reset Product stock to baseStock.");

    // 2. Fetch all events for Product ordered by globalSequence ASC
    const events = await EventStore.find({ aggregateType: "Product" }).sort({ globalSequence: 1 });
    logger.info(`[Projector] Replaying ${events.length} Product events...`);

    let lastSeq = 0;

    // 3. Replay deterministically
    for (const event of events) {
      await projectProductStockEvent(event);
      lastSeq = Math.max(lastSeq, event.globalSequence);
    }

    // 4. Update checkpoint
    await ProjectionCheckpoint.updateOne(
      { aggregateType: "Product" },
      { $set: { lastProcessedGlobalSequence: lastSeq } },
      { upsert: true }
    );
    logger.info(`[Projector] Rebuild completed for Product. Checkpoint set to globalSequence: ${lastSeq}`);
  } else {
    throw new Error(`Unsupported aggregateType for rebuild: ${aggregateType}`);
  }
};
