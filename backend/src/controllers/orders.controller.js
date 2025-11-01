import mongoose from "mongoose";
import Job from "../models/Job.js";
import Application from "../models/Application.js";

const oid = (id) => new mongoose.Types.ObjectId(id);

// Employer: requested (incoming apps), in-progress, completed (with escrow joined)
export const employerOrders = async (req, res) => {
  const me = oid(req.user.sub);

  const requested = await Application.aggregate([
    { $lookup: { from: "jobs", localField: "jobId", foreignField: "_id", as: "job" } },
    { $unwind: "$job" },
    { $match: { "job.employerId": me, "job.status": "open", status: "pending" } },
    { $sort: { createdAt: -1 } }
  ]);

  const inProgress = await Job.find({ employerId: me, status: { $in: ["assigned", "awaiting-approval"] } })
    .sort({ updatedAt: -1 }).lean();

  const completed = await Job.aggregate([
    { $match: { employerId: me, status: "completed" } },
    { $lookup: { from: "escrows", localField: "_id", foreignField: "jobId", as: "escrow" } },
    { $unwind: { path: "$escrow", preserveNullAndEmptyArrays: true } },
    { $sort: { updatedAt: -1 } }
  ]);

  res.json({ requested, inProgress, completed });
};

// Freelancer: requested, in-progress, completed (with escrow), rejected (with message)
export const freelancerOrders = async (req, res) => {
  const me = oid(req.user.sub);

  const requested = await Application.aggregate([
    { $match: { freelancerId: me, status: "pending" } },
    { $lookup: { from: "jobs", localField: "jobId", foreignField: "_id", as: "job" } },
    { $unwind: "$job" },
    { $sort: { createdAt: -1 } }
  ]);

  const inProgress = await Job.find({ assignedTo: me, status: { $in: ["assigned", "awaiting-approval"] } })
    .sort({ updatedAt: -1 }).lean();

  const completed = await Job.aggregate([
    { $match: { assignedTo: me, status: "completed" } },
    { $lookup: { from: "escrows", localField: "_id", foreignField: "jobId", as: "escrow" } },
    { $unwind: { path: "$escrow", preserveNullAndEmptyArrays: true } },
    { $sort: { updatedAt: -1 } }
  ]);

  const rejected = await Application.aggregate([
    { $match: { freelancerId: me, status: "rejected" } },
    { $lookup: { from: "jobs", localField: "jobId", foreignField: "_id", as: "job" } },
    { $unwind: "$job" },
    { $sort: { updatedAt: -1 } }
  ]);

  res.json({ requested, inProgress, completed, rejected });
};
