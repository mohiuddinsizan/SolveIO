import mongoose from "mongoose";
import User from "../models/User.js";
import Wallet from "../models/Wallet.js";
import Escrow from "../models/Escrow.js";
import Transaction from "../models/Transaction.js";


export const getMyProfile = async (req, res) => {
  try {
    // ADMIN
    if (req.user?.role === "admin") {
      const company = await Wallet.findOne({ type: "company" }).lean();

      const holdingAgg = await Escrow.aggregate([
        { $match: { status: "funded" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]);
      const holdingTotal = Number(holdingAgg?.[0]?.total || 0);

      const profitAgg = await Escrow.aggregate([
        { $match: { status: "released" } },
        { $group: { _id: null, total: { $sum: "$fee" } } },
      ]);
      const profitTotal = Number(profitAgg?.[0]?.total || 0);

      return res.json({
        user: {
          _id: "000000000000000000000000",
          name: process.env.ADMIN_USERNAME || "admin",
          email: `admin@${process.env.ADMIN_USERNAME || "admin"}.local`,
          role: "admin",
          skills: [],
          ratingAvg: 0,
          ratingCount: 0,
          walletBalance: Number(company?.balance || 0),
          holdingTotal,
          profitTotal,
          createdAt: new Date(0),
        },
      });
    }

    // NORMAL USERS
    const uid = String(req.user?.sub || req.user?.id || "");
    if (!uid || !mongoose.isValidObjectId(uid)) {
      return res.status(401).json({ error: "Invalid or missing user id in token" });
    }

    const user = await User.findById(uid)
      .select("name email role skills ratingAvg ratingCount createdAt")
      .lean();
    if (!user) return res.status(404).json({ error: "User not found" });

    const wallet = await Wallet.findOne({ ownerId: user._id, type: "user" }).lean();
    const walletBalance = Number(wallet?.balance || 0);

    let payoutSum = 0, tipSum = 0;
    if (user.role === "worker") {
      const payoutAgg = await Escrow.aggregate([
        { $match: { freelancerId: user._id, status: "released" } },
        { $group: { _id: null, total: { $sum: "$payout" } } },
      ]);
      payoutSum = Number(payoutAgg?.[0]?.total || 0);

      if (wallet?._id) {
        const tipAgg = await Transaction.aggregate([
          { $match: { walletId: wallet._id, type: "tip" } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]);
        tipSum = Number(tipAgg?.[0]?.total || 0);
      }
    }

    const totalEarned = Number((payoutSum + tipSum).toFixed(2));

    return res.json({
      user: {
        _id: user._id,
        name: user.name || "",
        email: user.email || "",
        role: user.role || "",
        skills: Array.isArray(user.skills) ? user.skills : [],
        ratingAvg: Number(user.ratingAvg || 0),
        ratingCount: Number(user.ratingCount || 0),
        walletBalance,
        earnedTotal: payoutSum,
        tipTotal: tipSum,
        totalEarned,
        createdAt: user.createdAt || new Date(0),
      },
    });
  } catch (e) {
    console.error("/me/profile error:", e);
    res.status(500).json({ error: e.message || "Internal error" });
  }
};


export const updateMySkills = async (req, res) => {
  try {
    const uid = String(req.user?.sub || req.user?.id || "");
    if (!uid || !mongoose.isValidObjectId(uid)) {
      return res.status(401).json({ error: "Invalid or missing user id" });
    }
    const { skills = [] } = req.body;
    const updated = await User.findByIdAndUpdate(
      uid,
      { $set: { skills } },
      { new: true }
    ).select("name email role skills ratingAvg ratingCount createdAt").lean();

    res.json({ user: updated });
  } catch (e) {
    res.status(500).json({ error: e.message || "Internal error" });
  }
};
