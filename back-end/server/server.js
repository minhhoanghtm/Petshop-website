import "./configs/env.js";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import session from "express-session";
import bcrypt from "bcryptjs";
import { logger } from "./logger/logger.js";
import {
  errorHandler,
  httpLogger,
  notFoundHandler,
  requestContextMiddleware,
} from "./logger/middleware.js";
import { initializeWorkers, closeWorkers } from "./workers/index.js";

// Load environment variables from .env file
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../.env");
logger.info("Loading .env", { envPath });
const result = dotenv.config({ path: envPath });
if (result.error) {
  logger.error("Failed to load .env file", { message: result.error.message });
} else {
  logger.info(".env file loaded successfully");
}

import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import cartRoutes from "./routes/cartRoutes.js";
import settingRoutes from "./routes/settingRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import aiRoutes from "./routes/AIRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import dashboadRoutes from "./routes/dashboardRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import voucherRoutes from "./routes/voucherRoutes.js";
import { protectedRoute } from "./middleware/authMiddleware.js";
import redisClient from "./configs/redisClient.js";
import User from "./models/User.js";
import { createRequire } from "module";
// Load connect-redis (CJS) via createRequire to avoid ESM import issues
const require = createRequire(import.meta.url);
const connectRedisModule = require("connect-redis");
// Normalize different export shapes from connect-redis (CJS/ESM variants)
let RedisStoreClass;
if (connectRedisModule && typeof connectRedisModule.RedisStore === "function") {
  // v7+: exports { RedisStore }
  RedisStoreClass = connectRedisModule.RedisStore;
} else if (typeof connectRedisModule === "function") {
  // older CJS: module is a function that accepts session and returns the store class
  RedisStoreClass = connectRedisModule(session);
} else if (
  connectRedisModule &&
  typeof connectRedisModule.default === "function"
) {
  RedisStoreClass = connectRedisModule.default(session);
} else if (
  connectRedisModule &&
  typeof connectRedisModule.create === "function"
) {
  RedisStoreClass = connectRedisModule.create(session);
} else {
  throw new Error("connect-redis: unsupported module shape");
}

const app = express();
// eslint-disable-next-line no-undef
const PORT = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json());
app.use(requestContextMiddleware);
app.use(httpLogger);

// Connect to MongoDB
const ensureUserPhoneIndex = async () => {
  try {
    const indexes = await User.collection.indexes();
    const phoneIndex = indexes.find((index) => index.name === "phone_1");

    if (phoneIndex && !phoneIndex.sparse) {
      await User.collection.dropIndex("phone_1");
    }

    await User.collection.createIndex(
      { phone: 1 },
      { unique: true, sparse: true, name: "phone_1" },
    );
  } catch (error) {
    logger.warn("Unable to ensure phone index", { message: error.message });
  }
};

const ensureBootstrapAdmin = async () => {
  try {
    const adminEmailRaw = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmailRaw || !adminPassword) {
      return;
    }

    const adminEmail = String(adminEmailRaw).trim().toLowerCase();
    if (!adminEmail) return;

    const existingAdmin = await User.findOne({ email: adminEmail });
    if (existingAdmin) {
      if (existingAdmin.role !== "admin") {
        existingAdmin.role = "admin";
        await existingAdmin.save();
        logger.info("Bootstrap admin role updated", { adminEmail });
      }
      return;
    }

    const hashed = bcrypt.hashSync(adminPassword, 10);
    await User.create({
      email: adminEmail,
      password: hashed,
      fullName: process.env.ADMIN_FULLNAME || "Administrator",
      birthDate: new Date(process.env.ADMIN_BIRTHDATE || "1990-01-01"),
      role: "admin",
      status: "Active",
    });

    logger.info("Bootstrap admin created", { adminEmail });
  } catch (error) {
    logger.warn("Unable to bootstrap admin", { message: error.message });
  }
};

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  logger.error("FATAL: MONGO_URI environment variable is not set. MongoDB will not connect.");
} else {
  logger.info("Attempting MongoDB connection...", { uri: MONGO_URI.replace(/:\/\/[^@]+@/, "://<credentials>@") });
}

mongoose
  .connect(MONGO_URI, {
    retryWrites: true,
    w: "majority",
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 15000,
  })
  .then(async () => {
    logger.info("Connected to MongoDB");
    await ensureUserPhoneIndex();
    await ensureBootstrapAdmin();
  })
  .catch((err) => {
    logger.error("FATAL: MongoDB connection failed!", {
      message: err.message,
      code: err.code,
      uri: MONGO_URI ? MONGO_URI.replace(/:\/\/[^@]+@/, "://<credentials>@") : "NOT SET",
    });
  });

  mongoose.connection.on("connecting", () => {
    logger.info("MongoDB connecting");
  });

  mongoose.connection.on("connected", () => {
    logger.info("MongoDB connected");
  });

  mongoose.connection.on("reconnected", () => {
    logger.info("MongoDB reconnected");
  });

  mongoose.connection.on("disconnected", () => {
    logger.warn("MongoDB disconnected");
  });

  mongoose.connection.on("error", (err) => {
    logger.error("MongoDB connection error", { message: err.message });
  });

// Routes

// Welcome endpoint
app.get("/api", (req, res) => {
  res.json({ message: "Welcome to the API!" });
});

app.get("/redis-test", async (req, res) => {
  try {
    await redisClient.set("shop", "petshop");

    const value = await redisClient.get("shop");

    logger.info("Redis test executed", { value });

    res.json({
      redis: value,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

//Lưu session vào Redis
app.use(
  session({
    store: new RedisStoreClass({ client: redisClient }),
    secret: process.env.SESSION_SECRET || "default_secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      sameSite: "lax",
      maxAge: 1000 * 60 * 1, // 1 minute
    },
  }),
);
app.set("trust proxy", 1); // Nếu ứng dụng chạy sau proxy (ví dụ: Nginx), để Express biết và xử lý cookie đúng cách
// ===== PUBLIC ROUTES (No authentication required) =====
// Authentication routes (signup, signin, signout)
app.use("/api/auth", authRoutes);

// Product and category routes (viewing only)
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/vouchers", voucherRoutes);

// ===== PROTECTED ROUTES (Authentication required) =====
// protectedRoute is applied inline per route — NOT globally,
// so unmatched paths still reach notFoundHandler correctly.
app.use("/api/users", protectedRoute, userRoutes);
app.use("/api/orders", protectedRoute, orderRoutes);
app.use("/api/carts", protectedRoute, cartRoutes);
app.use("/api/settings", protectedRoute, settingRoutes);
app.use("/api/dashboard", protectedRoute, dashboadRoutes);
app.use("/api/admin", protectedRoute, adminRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

initializeWorkers();

// Start the server
const server = app.listen(PORT, () => {
  logger.info(`Server is running: http://localhost:${PORT}`);
});

const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  // Dừng tiếp nhận request mới
  server.close(async () => {
    logger.info("HTTP server closed.");

    try {
      // Đóng BullMQ workers
      await closeWorkers();
      logger.info("BullMQ workers closed.");

      // Đóng Redis client
      if (redisClient && redisClient.isOpen) {
        await redisClient.quit();
        logger.info("Redis connection closed gracefully.");
      }

      // Đóng MongoDB connection
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        await mongoose.connection.close();
        logger.info("MongoDB connection closed.");
      }

      process.exit(0);
    } catch (err) {
      logger.error("Error during graceful shutdown:", { message: err.message, stack: err.stack });
      process.exit(1);
    }
  });

  // Khống chế thời gian tắt tối đa 15s để tránh stuck tiến trình
  setTimeout(() => {
    logger.warn("Graceful shutdown timeout. Forcing process exit.");
    process.exit(1);
  }, 15000);
};

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
