import mongoose from "mongoose";

const applicationSchema = new mongoose.Schema(
  {
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true },
    freelancerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    proposal: { type: String, default: "" },
    askPrice: { type: Number, required: true },
    status: { type: String, enum: ["pending","accepted","rejected"], default: "pending" },
    rejectMessage: { type: String, default: null }
  },
  { timestamps: true }
);

applicationSchema.index({ jobId: 1, freelancerId: 1 }, { unique: true });
export default mongoose.model("Application", applicationSchema);
