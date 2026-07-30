import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import redisClient from "../server/configs/redisClient.js";
import { createOrder } from "../server/services/orderService.js";
import { reserveCheckoutStock } from "../server/services/checkoutReservationService.js";
import Product from "../server/models/Product.js";
import Category from "../server/models/Category.js";
import User from "../server/models/User.js";
import EventStore from "../server/models/EventStore.js";
import Order from "../server/models/Order.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function run() {
  console.log("Connecting to Mongo...");
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Mongo connected!");

  // Ensure mock Redis is open
  console.log("Redis client isOpen:", redisClient.isOpen);
  console.log("Redis client isMock:", redisClient.isMock);

  // Setup test data
  console.log("Cleaning old test data...");
  await Product.deleteMany({ name: /Test Scratch Product/ });
  await Category.deleteMany({ name: /Test Scratch Category/ });
  await User.deleteMany({ email: /test_scratch_user/ });

  const cat = await Category.create({
    name: "Test Scratch Category",
    slug: "test-scratch-category",
    description: "Test",
    type: "SHOP CHO CÚN",
    slug_type: "shop-cho-cun",
  });

  const prod = await Product.create({
    name: "Test Scratch Product",
    slug: "test-scratch-product",
    price: 100000,
    stock: 10,
    description: "Test product",
    category_id: cat._id,
  });

  const user = await User.create({
    email: "test_scratch_user@gmail.com",
    fullName: "Test User",
    birthDate: new Date("1995-05-15"),
    gender: "male",
    status: "Active",
    password: "test_password_123",
  });

  console.log("Reserving stock...");
  const res = await reserveCheckoutStock(user._id, [
    { productId: prod._id.toString(), quantity: 2 },
  ]);
  console.log("Reservation result:", res);

  const orderData = {
    user_id: user._id.toString(),
    items: [{ product_id: prod._id.toString(), quantity: 2 }],
    total_price: 200000,
    fullName: "Test Customer",
    email: "cust@gmail.com",
    phone: "0909090909",
    address: "123 Street",
    province: "Hồ Chí Minh",
    payment_method: "COD",
    checkoutVersion: res.version,
  };

  console.log("Calling createOrder...");
  try {
    const order = await createOrder(orderData);
    console.log("Order created successfully!", order);
  } catch (err) {
    console.error("Order creation failed:", err);
  }

  // Cleanup
  console.log("Cleaning up...");
  await Product.deleteMany({ name: /Test Scratch Product/ });
  await Category.deleteMany({ name: /Test Scratch Category/ });
  await User.deleteMany({ email: /test_scratch_user/ });
  await mongoose.connection.close();
  console.log("Done!");
  process.exit(0);
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
