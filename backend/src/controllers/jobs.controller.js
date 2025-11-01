// backend/src/controllers/jobs.controller.js
import Job from "../models/Job.js";
import Application from "../models/Application.js";
import Escrow from "../models/Escrow.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import { releaseEscrow } from "./escrow.controller.js";
import { ALLOWED_SKILLS, ALLOWED_TAGS } from "../constants/meta.js";


/** Create a new job (employer only) */
export const createJob = async (req, res) => {
  try {
    const employerId = req.user.sub;
    let { title, description, requiredSkills = [], tags = [], budget } = req.body;

    if (!title || !budget) return res.status(400).json({ error: "Missing fields" });

    requiredSkills = (requiredSkills || []).map(s => String(s).trim().toLowerCase()).filter(Boolean);
    tags = (tags || []).map(t => String(t).trim().toLowerCase()).filter(Boolean);

    const badSkills = requiredSkills.filter(s => !ALLOWED_SKILLS.includes(s));
    const badTags = tags.filter(t => !ALLOWED_TAGS.includes(t));
    if (badSkills.length) return res.status(400).json({ error: `Invalid skills: ${badSkills.join(", ")}` });
    if (badTags.length) return res.status(400).json({ error: `Invalid tags: ${badTags.join(", ")}` });

    const job = await Job.create({
      employerId,
      title,
      description: description || "",
      requiredSkills,
      tags,
      budget,              // employer's initial offer
      agreedPrice: null,   // NEW: final negotiated price, set on assign
    });

    res.json(job);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

/** List open jobs with filters */
export const listJobs = async (req, res) => {
  try {
    const { q, tags, minBudget } = req.query;
    const filter = { status: "open" };

    if (q) {
      filter.$or = [
        { title: new RegExp(q, "i") },
        { description: new RegExp(q, "i") },
        { requiredSkills: { $in: [new RegExp(q, "i")] } },
        { tags: { $in: [new RegExp(q, "i")] } },
      ];
    }

    if (tags) {
      const list = String(tags)
        .split(",")
        .map(t => t.trim().toLowerCase())
        .filter(Boolean);
      if (list.length) filter.tags = { $all: list };
    }

    if (minBudget) filter.budget = { $gte: Number(minBudget) || 0 };

    const jobs = await Job.find(filter).sort({ createdAt: -1 }).limit(100).lean();
    res.json(jobs);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

/** Get job by ID */
export const getJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id).lean();
    if (!job) return res.status(404).json({ error: "Not found" });
    res.json(job);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

/** Apply to a job (worker only) */
export const applyJob = async (req, res) => {
  try {
    const freelancerId = req.user.sub;
    const jobId = req.params.id;
    const { proposal = "", askPrice } = req.body;

    if (!askPrice) return res.status(400).json({ error: "askPrice required" });

    const job = await Job.findById(jobId);
    if (!job || job.status !== "open") return res.status(400).json({ error: "Job not open" });

    const app = await Application.create({ jobId, freelancerId, proposal, askPrice });
    res.json(app);
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: "Already applied" });
    res.status(500).json({ error: e.message });
  }
};

/** List applicants (employer only, must own the job) */
export const listApplicants = async (req, res) => {
  try {
    const jobId = req.params.id;
    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ error: "Job not found" });
    if (String(job.employerId) !== req.user.sub) return res.status(403).json({ error: "Forbidden" });

    const applicants = await Application
      .find({ jobId })
      .populate("freelancerId", "name email skills")
      .sort({ createdAt: -1 })
      .lean();

    res.json(applicants);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// ...top of file unchanged

/** Assign a freelancer (employer only) */
export const assignJob = async (req, res) => {
  try {
    const jobId = req.params.id;
    const { applicationId } = req.body;

    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ error: "Job not found" });
    if (String(job.employerId) !== req.user.sub) return res.status(403).json({ error: "Forbidden" });
    if (job.status !== "open") return res.status(400).json({ error: "Job not open" });

    const app = await Application.findById(applicationId);
    if (!app || String(app.jobId) !== String(jobId)) {
      return res.status(400).json({ error: "Invalid application" });
    }

    // reject others, accept this one
    await Application.updateMany(
      { jobId, _id: { $ne: app._id } },
      { $set: { status: "rejected", rejectMessage: "Sorry! Already found a freelancer" } }
    );
    app.status = "accepted";
    await app.save();

    // lock agreed amount (negotiated askPrice) onto the job
    job.status = "assigned";
    job.assignedTo = app.freelancerId;
    job.agreedAmount = Number(app.askPrice); // <-- key line
    job.freelancerConfirm = false;
    job.employerConfirm = false;
    job.escrowStatus = "unfunded";
    await job.save();

    // create escrow shell (unfunded) using agreedAmount
    let es = await Escrow.findOne({ jobId: job._id });
    if (!es) {
      await Escrow.create({
        jobId: job._id,
        employerId: job.employerId,
        freelancerId: job.assignedTo,
        amount: job.agreedAmount ?? job.budget,
        status: "unfunded",
      });
    }

    res.json({
      ok: true,
      jobId: job._id,
      assignedTo: job.assignedTo,
      escrowRequired: true,
      agreedAmount: job.agreedAmount,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};


/** Escrow status (idempotent) */
export const getEscrow = async (req, res) => {
  try {
    const jobId = req.params.id;
    const job = await Job.findById(jobId).lean();
    if (!job) return res.status(404).json({ error: "Job not found" });

    const es = await Escrow.findOne({ jobId }).lean();
    const status = es?.status || job.escrowStatus || "unfunded";
    const amount = es?.amount ?? job?.budget ?? 0;

    res.json({ status, amount });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

/** Fund escrow (employer only, idempotent) */
export const fundEscrow = async (req, res) => {
  try {
    const jobId = req.params.id;
    const uid = req.user.sub;

    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ error: "Job not found" });
    if (String(job.employerId) !== uid) return res.status(403).json({ error: "Only employer can fund" });
    if (job.status !== "assigned") return res.status(400).json({ error: "Escrow can be funded only after assignment" });

    const es = await Escrow.findOne({ jobId });
    if (!es) return res.status(400).json({ error: "Escrow not initialized" });

    if (es.status === "funded" && job.escrowStatus === "funded") {
      return res.json({ ok: true, status: "funded" }); // idempotent
    }

    es.status = "funded";
    await es.save();

    job.escrowStatus = "funded";
    await job.save();

    // (Optional) move money to company—if you persist admin wallet, do it here
    return res.json({ ok: true, status: "funded" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

/** Freelancer submits work (requires escrow funded) */
export const submitWork = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ error: "Job not found" });
    if (String(job.assignedTo) !== req.user.sub) return res.status(403).json({ error: "Forbidden" });

    if (!["assigned", "awaiting-approval"].includes(job.status)) {
      return res.status(400).json({ error: "Job not in a submit-able state" });
    }

    const es = await Escrow.findOne({ jobId: job._id });
    if (!es || es.status !== "funded") return res.status(400).json({ error: "Escrow not funded yet" });

    const { note = "", url = "" } = req.body;
    job.submission = { note, url };
    job.freelancerConfirm = true;
    job.status = "awaiting-approval";
    await job.save();

    res.json({ ok: true, job });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

/** Employer approves (if freelancer submitted) → release escrow (95/5 split) */

export const approveWork = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ error: "Job not found" });
    if (String(job.employerId) !== req.user.sub) return res.status(403).json({ error: "Forbidden" });

    if (!job.freelancerConfirm) return res.status(400).json({ error: "Freelancer has not submitted yet" });

    job.employerConfirm = true;
    await job.save();

    if (job.freelancerConfirm && job.employerConfirm) {
      await releaseEscrow(job._id);
    }

    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

/** Ratings (post-completion, either side can rate the other) */
export const rateJob = async (req, res) => {
  try {
    const { score, comment = "" } = req.body;
    if (!score || score < 1 || score > 5) return res.status(400).json({ error: "Score 1-5 required" });

    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ error: "Job not found" });
    if (job.status !== "completed") return res.status(400).json({ error: "Job not completed" });

    const now = new Date();

    // employer rates freelancer
    if (String(job.employerId) === req.user.sub) {
      if (job.ratingEmployerToFreelancer?.score) return res.status(400).json({ error: "Already rated" });
      job.ratingEmployerToFreelancer = { score, comment, at: now };
      await job.save();

      const u = await User.findById(job.assignedTo);
      if (u) {
        const nextCount = (u.ratingCount || 0) + 1;
        const nextAvg = ((u.ratingAvg || 0) * (u.ratingCount || 0) + score) / nextCount;
        u.ratingAvg = Number(nextAvg.toFixed(2));
        u.ratingCount = nextCount;
        await u.save();
      }
      return res.json({ ok: true });
    }

    // freelancer rates employer
    if (String(job.assignedTo) === req.user.sub) {
      if (job.ratingFreelancerToEmployer?.score) return res.status(400).json({ error: "Already rated" });
      job.ratingFreelancerToEmployer = { score, comment, at: now };
      await job.save();

      const u = await User.findById(job.employerId);
      if (u) {
        const nextCount = (u.ratingCount || 0) + 1;
        const nextAvg = ((u.ratingAvg || 0) * (u.ratingCount || 0) + score) / nextCount;
        u.ratingAvg = Number(nextAvg.toFixed(2));
        u.ratingCount = nextCount;
        await u.save();
      }
      return res.json({ ok: true });
    }

    return res.status(403).json({ error: "Not part of this job" });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

/** Chat: only employer or assigned worker can read/send */
// GET /jobs/:id/messages
export const getMessages = async (req, res) => {
  try {
    const jobId = req.params.id;
    const job = await Job.findById(jobId).lean();
    if (!job) return res.status(404).json({ error: "Job not found" });

    const uid = req.user.sub;
    const allowed = [String(job.employerId), String(job.assignedTo)];
    if (!allowed.includes(String(uid))) return res.status(403).json({ error: "Forbidden" });

    const msgs = await Message.find({ jobId }).sort({ createdAt: 1 }).lean();
    res.json(msgs);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// POST /jobs/:id/messages
export const sendMessage = async (req, res) => {
  try {
    const jobId = req.params.id;
    const { text = "" } = req.body || {};
    const job = await Job.findById(jobId).lean();
    if (!job) return res.status(404).json({ error: "Job not found" });

    const uid = req.user.sub;
    const allowed = [String(job.employerId), String(job.assignedTo)];
    if (!allowed.includes(String(uid))) return res.status(403).json({ error: "Forbidden" });

    const m = await Message.create({ jobId, from: uid, text });
    res.json({ ok: true, message: m });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

/** Optional: employer sends a tip after completion */
// POST /jobs/:id/tip
export const tipFreelancer = async (req, res) => {
  try {
    const jobId = req.params.id;
    const { amount } = req.body || {};
    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ error: "Job not found" });
    if (String(job.employerId) !== req.user.sub) return res.status(403).json({ error: "Forbidden" });
    if (job.status !== "completed") return res.status(400).json({ error: "Only after completion" });

    const tip = Math.max(0, Number(amount || 0));
    if (!tip) return res.status(400).json({ error: "Amount required" });

    const worker = await User.findById(job.assignedTo);
    if (worker) {
      worker.walletBalance = Number(worker.walletBalance || 0) + tip;
      await worker.save();
    }
    res.json({ ok: true, tip });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
