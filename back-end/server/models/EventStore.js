import mongoose from "mongoose";

const eventStoreSchema = new mongoose.Schema(
  {
    aggregateId: {
      type: String,
      required: true,
      index: true,
    },
    aggregateType: {
      type: String,
      required: true,
    },
    version: {
      type: Number,
      required: true,
    },
    eventType: {
      type: String,
      required: true,
    },
    globalSequence: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },
    correlationId: {
      type: String,
      required: true,
      index: true,
    },
    causationId: {
      type: String,
      required: true,
    },
    idempotencyKey: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { collection: "event_store" }
);

// Compound index to guarantee per-aggregate causal ordering and prevent race conditions
eventStoreSchema.index({ aggregateId: 1, version: 1 }, { unique: true });

const EventStore = mongoose.model("EventStore", eventStoreSchema);
export default EventStore;
