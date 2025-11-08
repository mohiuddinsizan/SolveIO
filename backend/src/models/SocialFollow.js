import mongoose from "mongoose";

const socialFollowSchema = new mongoose.Schema(
  {
    followerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    followingId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  },
  { timestamps: true }
);

// Prevent duplicates
socialFollowSchema.index({ followerId: 1, followingId: 1 }, { unique: true });

export default mongoose.model("SocialFollow", socialFollowSchema);
