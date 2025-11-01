import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true },
    from:  { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    to:    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text:  { type: String, required: true }
  },
  { timestamps: true }
);

export default mongoose.model("Message", messageSchema);
