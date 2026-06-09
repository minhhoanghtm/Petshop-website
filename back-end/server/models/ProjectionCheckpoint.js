import mongoose from "mongoose";

const projectionCheckpointSchema = new mongoose.Schema(
  {
    aggregateType: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    lastProcessedGlobalSequence: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  { collection: "projection_checkpoints" }
);

const ProjectionCheckpoint = mongoose.models.ProjectionCheckpoint || mongoose.model("ProjectionCheckpoint", projectionCheckpointSchema);
export default ProjectionCheckpoint;
