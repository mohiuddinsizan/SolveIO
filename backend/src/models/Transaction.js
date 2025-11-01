import mongoose from "mongoose";

const txSchema = new mongoose.Schema(
  {
    walletId: { type: mongoose.Schema.Types.ObjectId, ref: "Wallet", required: true },
    type: { type: String, enum: ["hold", "release", "fee", "payout", "tip"], required: true },
    amount: { type: Number, required: true }, // positive value; use negative for "release" only
    meta: { type: Object, default: {} },
  },
  { timestamps: true }
);

txSchema.index({ walletId: 1, createdAt: -1 });

export default mongoose.model("Transaction", txSchema);
