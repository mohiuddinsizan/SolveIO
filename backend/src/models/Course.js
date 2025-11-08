// backend/src/models/Course.js
import mongoose from "mongoose";

const videoSchema = new mongoose.Schema({
  title: { type: String, required: true },
  url:   { type: String, required: true },
  size: Number,
  mime: String,
  description: { type: String, default: "" }, // <-- add this
  durationSec: { type: Number, default: 0 },  // if you’re storing it
  order: { type: Number, default: 0 },
});

const moduleSchema = new mongoose.Schema({
  title: { type: String, required: true },
  order: { type: Number, default: 0 },
  videos: [videoSchema],
});

const courseSchema = new mongoose.Schema(
  {
    creator: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    priceCents: { type: Number, default: 0 },
    thumbnailUrl: { type: String, default: "" },
    modules: [moduleSchema],
    tags: { type: [String], default: [], index: false },
    buyers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true }
);

courseSchema.index({ title: "text", description: "text" });

export default mongoose.model("Course", courseSchema);
