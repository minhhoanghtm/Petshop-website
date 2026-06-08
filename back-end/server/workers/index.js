import { logger } from "../logger/logger.js";
import { startOtpWorker } from "./otpWorker.js";

let workers = null;

export const initializeWorkers = () => {
  if (workers) {
    return workers;
  }

  try {
    workers = {
      otpWorker: startOtpWorker(),
    };

    logger.info("Background workers initialized");
    return workers;
  } catch (error) {
    logger.warn("Background workers disabled", {
      message: error.message,
    });

    workers = null;
    return null;
  }
};

export const closeWorkers = async () => {
  if (!workers) {
    return;
  }

  await Promise.allSettled(Object.values(workers).map((worker) => worker.close()));
  workers = null;
};