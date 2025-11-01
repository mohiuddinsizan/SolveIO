import "dotenv/config";
import mongoose from "mongoose";
import app from "./app.js";
import { ensureAdmin } from "./utils/ensureAdmin.js"; // <-- add this import


const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

mongoose
  .connect(MONGO_URI)
  .then(async () => {
    console.log("✅ Connected to MongoDB Atlas");
    await ensureAdmin();
    app.listen(PORT, () => console.log(`🚀 API on http://localhost:${PORT}`));
  })
  .catch((err) => console.error("MongoDB connection error:", err));
