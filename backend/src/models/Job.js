// backend/src/models/Job.js
import mongoose from "mongoose";

const AttachmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    url:  { type: String, required: true },
    mime: { type: String, required: true },
    size: { type: Number, required: true },
  },
  { _id: false }
);

const reviewSchema = new mongoose.Schema({
  rating:    { type: Number, min: 1, max: 5, required: true },
  comment:   { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

const jobSchema = new mongoose.Schema(
  {
    employerId:   { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title:        { type: String, required: true, trim: true },
    description:  { type: String, default: "" },
    requiredSkills: { type: [String], default: [] },
    tags:           { type: [String], default: [] },

    attachments: { type: [AttachmentSchema], default: [] },

    budget:        { type: Number, required: true, min: 0 },
    acceptedPrice: { type: Number, default: null, min: 0 },

    status: {
      type: String,
      enum: ["open", "assigned", "awaiting-approval", "completed", "disputed"],
      default: "open",
      index: true
    },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },

    submission: {
      note: { type: String, default: "" },
      url:  { type: String, default: "" }
    },
    freelancerConfirm: { type: Boolean, default: false },
    employerConfirm:   { type: Boolean, default: false },

    escrowStatus: { type: String, enum: ["unfunded", "funded", "released"], default: "unfunded" },

    // NEW: persisted reviews (immutable once set)
    employerReview:   { type: reviewSchema, default: null }, // employer -> freelancer
    freelancerReview: { type: reviewSchema, default: null }, // freelancer -> employer

    // legacy mirrors (kept for backward compatibility if older pages read these)
    ratingEmployerToFreelancer: { type: { score: Number, comment: String, at: Date }, default: null },
    ratingFreelancerToEmployer: { type: { score: Number, comment: String, at: Date }, default: null },

    // timestamps for finalization
    approvedAt:  { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true }
  }
);

// virtual compatibility
jobSchema.virtual("agreedAmount")
  .get(function () { return this.acceptedPrice; })
  .set(function (v) { this.acceptedPrice = v; });

jobSchema.virtual("finalAmount").get(function () {
  return typeof this.acceptedPrice === "number" && this.acceptedPrice > 0
    ? this.acceptedPrice
    : this.budget;
});

jobSchema.index({ employerId: 1, createdAt: -1 });
jobSchema.index({ assignedTo: 1, status: 1, createdAt: -1 });

export default mongoose.model("Job", jobSchema);
