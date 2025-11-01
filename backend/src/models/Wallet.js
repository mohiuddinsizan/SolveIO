import mongoose from "mongoose";

const walletSchema = new mongoose.Schema(
  {
    // company wallet (escrow holding + profit) has type=company and no ownerId
    type: { type: String, enum: ["company", "user"], required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    balance: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// ensure only one company wallet
walletSchema.index({ type: 1 }, { unique: true, partialFilterExpression: { type: "company" } });
// unique per user
walletSchema.index(
  { ownerId: 1, type: 1 },
  { unique: true, partialFilterExpression: { ownerId: { $exists: true, $ne: null }, type: "user" } }
);

export default mongoose.model("Wallet", walletSchema);
