import mongoose from "mongoose";
import Escrow from "../models/Escrow.js";
import Job from "../models/Job.js";
import Wallet from "../models/Wallet.js";
import Transaction from "../models/Transaction.js";

const money = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Company wallet: single record with type:"company"
async function getOrCreateCompanyWallet(session = null) {
  let w = await Wallet.findOne({ type: "company" }).session(session);
  if (!w) w = await Wallet.create([{ type: "company", balance: 0 }], { session }).then(d => d[0]);
  return w;
}

// User wallet: (ownerId, type:"user")
async function getOrCreateUserWallet(userId, session = null) {
  let w = await Wallet.findOne({ ownerId: userId, type: "user" }).session(session);
  if (!w) w = await Wallet.create([{ ownerId: userId, type: "user", balance: 0 }], { session }).then(d => d[0]);
  return w;
}

/** GET /jobs/:id/escrow */
export const getEscrow = async (req, res) => {
  try {
    const jobId = req.params.id;
    const escrow = await Escrow.findOne({ jobId }).lean();
    if (!escrow) return res.json({ status: "unfunded" });
    res.json(escrow);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

/** POST /jobs/:id/escrow/fund (employer) */
export const fundEscrow = async (req, res) => {
  try {
    const jobId = req.params.id;
    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ error: "Job not found" });
    if (String(job.employerId) !== req.user.sub) return res.status(403).json({ error: "Forbidden" });
    if (!["assigned", "awaiting-approval"].includes(job.status))
      return res.status(400).json({ error: "Job is not in fundable state" });

    let escrow = await Escrow.findOne({ jobId: job._id });
    if (!escrow) {
      escrow = await Escrow.create({
        jobId: job._id,
        employerId: job.employerId,
        freelancerId: job.assignedTo,
        amount: job.agreedAmount ?? job.budget,
        status: "unfunded",
      });
    }
    if (["funded", "released"].includes(escrow.status)) {
      return res.json(escrow);
    }

    const amount = money(escrow.amount);
    const company = await getOrCreateCompanyWallet();

    // HARD GUARD
    if (!company?._id || !(amount > 0)) {
      console.error("FUND GUARD", { companyId: company?._id, amount });
      return res.status(500).json({ error: "Internal wallet error (fund)" });
    }

    company.balance = money(company.balance + amount);
    await company.save();

    await Transaction.create({
      walletId: company._id,
      type: "hold",
      amount,
      meta: { jobId: job._id },
    });

    escrow.status = "funded";
    escrow.fundedAt = new Date();
    await escrow.save();

    job.escrowStatus = "funded";
    await job.save();

    res.json(escrow);
  } catch (e) {
    console.error("fundEscrow error:", e);
    res.status(500).json({ error: e.message });
  }
};

/** INTERNAL: release escrow on approval */
export async function releaseEscrow(jobId) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const job = await Job.findById(jobId).session(session);
      if (!job) throw new Error("Job not found");

      const escrow = await Escrow.findOne({ jobId: job._id }).session(session);
      if (!escrow || escrow.status !== "funded") throw new Error("Escrow not funded");

      const amount = money(escrow.amount);
      const fee = money(amount * 0.05);
      const payout = money(amount - fee);

      const company    = await getOrCreateCompanyWallet(session);
      const freelancer = await getOrCreateUserWallet(job.assignedTo, session);

      if (!company?._id || !freelancer?._id || !(amount > 0)) {
        console.error("RELEASE GUARD", { companyId: company?._id, freelancerId: freelancer?._id, amount });
        throw new Error("Internal wallet error (release)");
      }

      // Wallet balances
      company.balance    = money(company.balance - amount + fee);
      freelancer.balance = money(freelancer.balance + payout);
      await company.save({ session });
      await freelancer.save({ session });

      // Transactions (use array + session)
      await Transaction.create([
        { walletId: company._id,    type: "release", amount: money(-amount), meta: { jobId: job._id } },
        { walletId: company._id,    type: "fee",     amount: fee,            meta: { jobId: job._id } },
        { walletId: freelancer._id, type: "payout",  amount: payout,         meta: { jobId: job._id } },
      ], { session });

      // Escrow + Job
      escrow.status     = "released";
      escrow.releasedAt = new Date();
      escrow.fee        = fee;
      escrow.payout     = payout;
      await escrow.save({ session });

      job.status       = "completed";
      job.escrowStatus = "released";
      await job.save({ session });
    });
  } finally {
    await session.endSession();
  }
}


/** POST /jobs/:id/tip (employer) */
export const tipFreelancer = async (req, res) => {
  try {
    const jobId = req.params.id;
    const tip = money(req.body?.amount);
    if (!tip || tip <= 0) return res.status(400).json({ error: "Invalid tip" });

    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ error: "Job not found" });
    if (String(job.employerId) !== req.user.sub) return res.status(403).json({ error: "Forbidden" });

    const freelancer = await getOrCreateUserWallet(job.assignedTo);
    if (!freelancer?._id) return res.status(500).json({ error: "Internal wallet error (tip)" });

    freelancer.balance = money(freelancer.balance + tip);
    await freelancer.save();

    await Transaction.create({
      walletId: freelancer._id,
      type: "tip",
      amount: tip,
      meta: { jobId: job._id },
    });

    res.json({ ok: true });
  } catch (e) {
    console.error("tipFreelancer error:", e);
    res.status(500).json({ error: e.message });
  }
}
