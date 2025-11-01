import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["worker", "employer", "admin"], required: true },
    email: { type: String, unique: true, required: true },
    name: { type: String, required: true },
    passwordHash: { type: String, required: true },
    skills: [String],
    reliabilityScore: { type: Number, default: 0 },
    riskScore: { type: Number, default: 0 },

    // rating aggregates
    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    profitTotal: { type: Number, default: 0 },
    // wallet balance (for demo when escrow releases)
    walletBalance: { type: Number, default: 0 }
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
