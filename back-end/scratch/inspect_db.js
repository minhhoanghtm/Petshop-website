import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function inspectDb() {
  console.log("Connecting to:", process.env.MONGO_URI);
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected successfully!");

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log(`Found ${collections.length} collections:`);
    for (const coll of collections) {
      const count = await db.collection(coll.name).countDocuments();
      console.log(` - ${coll.name}: ${count} documents`);
    }
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await mongoose.connection.close();
  }
}

inspectDb();
