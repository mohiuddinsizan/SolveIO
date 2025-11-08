import mongoose from "mongoose";

const socialDMMessageSchema = new mongoose.Schema(
  {
    from: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    to:   { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

// optional compound index to speed up 1:1 threads
socialDMMessageSchema.index({ from: 1, to: 1, createdAt: -1 });

export default mongoose.model("SocialDMMessage", socialDMMessageSchema);
