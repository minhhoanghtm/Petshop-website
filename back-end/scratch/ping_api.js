import axios from "axios";

async function ping() {
  try {
    const res = await axios.get("http://localhost:5000/api");
    console.log("API ping response:", res.data);
  } catch (error) {
    console.error("API ping failed:", error.message);
  }
}

ping();
