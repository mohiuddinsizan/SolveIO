import mongoose from "mongoose";

const escrowSchema = new mongoose.Schema(
  {
    jobId:        { type: mongoose.Schema.Types.ObjectId, ref: "Job", unique: true, required: true },
    employerId:   { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    freelancerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    amount:       { type: Number, required: true },
    status:       { type: String, enum: ["unfunded","funded","released","refunded"], default: "unfunded" },
    txRef:        { type: String, default: "" },

    // NEW (you already use these)
    fundedAt:     { type: Date },
    releasedAt:   { type: Date },
    fee:          { type: Number, default: 0 },
    payout:       { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model("Escrow", escrowSchema);
