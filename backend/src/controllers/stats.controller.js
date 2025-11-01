// backend/src/controllers/stats.controller.js
import mongoose from "mongoose";
import Job from "../models/Job.js";
import Escrow from "../models/Escrow.js";
import User from "../models/User.js";
import Wallet from "../models/Wallet.js";

const money = (n) => Math.round((Number(n) || 0) * 100) / 100;

export const adminStats = async (_req, res) => {
  try {
    const holdingAgg = await Escrow.aggregate([
      { $match: { status: "funded" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const profitAgg = await Escrow.aggregate([
      { $match: { status: "released" } },
      { $group: { _id: null, total: { $sum: "$fee" } } },
    ]);

    const totals = await Job.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);

    const jobs = totals.reduce((acc, t) => {
      acc[t._id] = t.count; return acc;
    }, { open:0, assigned:0, "awaiting-approval":0, completed:0, disputed:0 });

    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const monthly = await Escrow.aggregate([
      { $match: { status: "released", releasedAt: { $gte: start } } },
      { $group: {
        _id: { y: { $year:"$releasedAt"}, m:{ $month:"$releasedAt"} },
        value: { $sum: "$fee" }
      }},
      { $sort: { "_id.y": 1, "_id.m": 1 } }
    ]);

    const monthlyProfit = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = monthly.find(x => x._id.y === d.getFullYear() && x._id.m === (d.getMonth()+1));
      monthlyProfit.push({
        label: d.toLocaleString(undefined,{month:"short"}),
        value: key?.value || 0
      });
    }

    res.json({
      holding: Number(holdingAgg?.[0]?.total || 0),
      profitTotal: Number(profitAgg?.[0]?.total || 0),
      jobs,
      monthlyProfit,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const employerStats = async (req, res) => {
  try {
    const employerId = new mongoose.Types.ObjectId(req.user.sub);
    const totalPosted = await Job.countDocuments({ employerId });
    const open = await Job.countDocuments({ employerId, status: "open" });
    const inProgress = await Job.countDocuments({ employerId, status: { $in: ["assigned", "awaiting-approval"] } });
    const completed = await Job.countDocuments({ employerId, status: "completed" });
    res.json({ totalPosted, open, inProgress, completed });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

/**
 * GET /stats/freelancer
 * Returns:
 *   - jobsByStatus: [{_id: status, count, amount}]  // amount = acceptedPrice ?? agreedAmount ?? budget
 *   - releasedWallet: { amount, count }              // sum of Escrow.payout
 *   - earningsSeries: [{ n, value, cum, releasedAt}] // payouts in release order, cumulative
 *   - recent: []                                      // placeholder
 * Supports ?from=ISO for time filtering (applies to createdAt for jobs, releasedAt/createdAt for earnings)
 */
export const freelancerStats = async (req, res) => {
  try {
    const freelancerId = new mongoose.Types.ObjectId(req.user.sub);
    const fromIso = req.query?.from;
    const fromDate = fromIso ? new Date(fromIso) : null;

    // ---------- Jobs by status (use final price: acceptedPrice ?? agreedAmount ?? budget) ----------
    const jobsByStatus = await Job.aggregate([
      { $match: {
          assignedTo: freelancerId,
          ...(fromDate ? { createdAt: { $gte: fromDate } } : {}),
        } },
      { $project: {
          status: 1,
          amount: {
            $ifNull: [
              "$acceptedPrice",
              { $ifNull: ["$agreedAmount", "$budget"] } // covers legacy/agreedAmount and fallback to budget
            ]
          }
        } },
      { $group: {
          _id: "$status",
          count: { $sum: 1 },
          amount: { $sum: "$amount" }
        } },
      { $sort: { _id: 1 } }
    ]);

    // ---------- Released earnings KPI (sum payouts) ----------
    const releasedAgg = await Escrow.aggregate([
      { $match: {
          freelancerId,
          status: "released",
          ...(fromDate ? { releasedAt: { $gte: fromDate } } : {}),
        } },
      { $group: {
          _id: null,
          amount: { $sum: { $ifNull: ["$payout", 0] } },
          count: { $sum: 1 }
        } }
    ]);
    const releasedWallet = {
      amount: money(releasedAgg?.[0]?.amount || 0),
      count: Number(releasedAgg?.[0]?.count || 0)
    };

    // ---------- Cumulative earnings series (order number → cumulative payout) ----------
    // Fallback for missing releasedAt → createdAt → ObjectId time
    const releasedRows = await Escrow.aggregate([
      { $match: {
          freelancerId,
          status: "released",
          ...(fromDate ? { $expr: {
            $gte: [
              { $ifNull: ["$releasedAt", { $ifNull: ["$createdAt", "$$NOW"] }] },
              fromDate
            ]
          }} : {}),
        } },
      { $addFields: {
          _sortDate: { $ifNull: ["$releasedAt", { $ifNull: ["$createdAt", "$$NOW"] }] },
        } },
      { $project: {
          payout: { $ifNull: ["$payout", 0] },
          releasedAt: "$_sortDate"
        } },
      { $sort: { releasedAt: 1, _id: 1 } }
    ]);

    let cum = 0;
    const earningsSeries = releasedRows.map((r, i) => {
      const one = money(r.payout || 0);
      cum = money(cum + one);
      return { n: i + 1, value: one, cum, releasedAt: r.releasedAt };
    });

    res.json({
      jobsByStatus: jobsByStatus.map(j => ({
        _id: j._id,
        count: j.count,
        amount: money(j.amount)
      })),
      releasedWallet,
      recent: [],
      earningsSeries
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
