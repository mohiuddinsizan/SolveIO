import mongoose from "mongoose";

const CoursePurchaseSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    priceCents: { type: Number, required: true },
  },
  { timestamps: true }
);

// one purchase per user/course
CoursePurchaseSchema.index({ user: 1, course: 1 }, { unique: true });

export default mongoose.model("CoursePurchase", CoursePurchaseSchema);
