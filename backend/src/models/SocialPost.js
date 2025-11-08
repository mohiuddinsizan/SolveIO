import mongoose from "mongoose";

const reactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["like"], default: "like" },
  },
  { _id: false, timestamps: true }
);

const commentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

const imageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    mime: { type: String },
    publicId: { type: String },   // present when Cloudinary is used
    width: { type: Number },
    height: { type: Number },
    bytes: { type: Number },
  },
  { _id: false }
);

const socialPostSchema = new mongoose.Schema(
  {
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    text: { type: String, trim: true, default: "" },
    images: [imageSchema],          // ✅ supports image posts
    reactions: [reactionSchema],
    comments: [commentSchema],
    visibility: { type: String, enum: ["public"], default: "public" },
  },
  { timestamps: true }
);

export default mongoose.model("SocialPost", socialPostSchema);
