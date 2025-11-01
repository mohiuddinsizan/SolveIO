// models/Job.js
import mongoose from "mongoose";

const jobSchema = new mongoose.Schema(
  {
    employerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    requiredSkills: { type: [String], default: [] },
    tags: { type: [String], default: [] },

    // Employer's initial offer
    budget: { type: Number, required: true, min: 0 },

    // Final negotiated price (what the employer accepted)
    acceptedPrice: { type: Number, default: null, min: 0 },

    // Order state
    status: {
      type: String,
      enum: ["open", "assigned", "awaiting-approval", "completed", "disputed"],
      default: "open",
      index: true
    },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },

    // submission/confirmations
    submission: {
      note: { type: String, default: "" },
      url:  { type: String, default: "" }
    },
    freelancerConfirm: { type: Boolean, default: false },
    employerConfirm:   { type: Boolean, default: false },

    // escrow mirror
    escrowStatus: { type: String, enum: ["unfunded", "funded", "released"], default: "unfunded" },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true }
  }
);

/**
 * Alias for backward/forward compatibility:
 * - Controllers that use job.agreedAmount will still work.
 * - Storage remains in "acceptedPrice".
 */
jobSchema.virtual("agreedAmount")
  .get(function () { return this.acceptedPrice; })
  .set(function (v) { this.acceptedPrice = v; });

/**
 * The definitive amount to use in UI/analytics:
 * falls back to budget when not yet negotiated.
 * (Note: virtuals don’t work inside Mongo aggregations;
 * use {$ifNull:["$acceptedPrice","$budget"]} there.)
 */
jobSchema.virtual("finalAmount").get(function () {
  return typeof this.acceptedPrice === "number" && this.acceptedPrice > 0
    ? this.acceptedPrice
    : this.budget;
});

// Helpful compound indexes for feeds/analytics
jobSchema.index({ employerId: 1, createdAt: -1 });
jobSchema.index({ assignedTo: 1, status: 1, createdAt: -1 });

export default mongoose.model("Job", jobSchema);
