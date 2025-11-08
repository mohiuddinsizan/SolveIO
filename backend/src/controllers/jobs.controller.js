// backend/src/controllers/jobs.controller.js
import Job from "../models/Job.js";
import Application from "../models/Application.js";
import Escrow from "../models/Escrow.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import { releaseEscrow } from "./escrow.controller.js";
import { ALLOWED_SKILLS, ALLOWED_TAGS } from "../constants/meta.js";

/* --------------------------- helpers --------------------------- */
function parseArrayMaybe(val) {
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    const s = val.trim();
    if (s.startsWith("[") && s.endsWith("]")) {
      try {
        const arr = JSON.parse(s);
        return Array.isArray(arr) ? arr : [];
      } catch {}
    }
    return s.split(",").map((x) => x.trim()).filter(Boolean);
  }
  return [];
}

function normalizeLowerDedupe(list) {
  const out = [];
  const seen = new Set();
  for (const v of list || []) {
    const s = String(v || "").trim().toLowerCase();
    if (s && !seen.has(s)) { seen.add(s); out.push(s); }
  }
  return out;
}

async function bumpUserRating(userId, rating) {
  if (!userId || !Number.isFinite(Number(rating))) return;
  const u = await User.findById(userId);
  if (!u) return;
  const prevCount = Number(u.ratingCount || 0);
  const prevAvg = Number(u.ratingAvg || 0);
  const nextCount = prevCount + 1;
  const nextAvg = ((prevAvg * prevCount) + Number(rating)) / nextCount;
  u.ratingCount = nextCount;
  u.ratingAvg = Number(nextAvg.toFixed(2));
  await u.save();
}

/** Create a new job (employer only) */
export const createJob = async (req, res) => {
  try {
    const employerId = req.user?.sub;
    if (!employerId) return res.status(401).json({ error: "Not authenticated" });

    const title = String(req.body?.title || "").trim();
    const description = String(req.body?.description || "");
    const budget = Number(req.body?.budget);

    if (!title) return res.status(400).json({ error: "Title required" });
    if (!Number.isFinite(budget) || budget <= 0) {
      return res.status(400).json({ error: "Budget must be a positive number" });
    }

    let requiredSkills = normalizeLowerDedupe(parseArrayMaybe(req.body?.requiredSkills));
    let tags           = normalizeLowerDedupe(parseArrayMaybe(req.body?.tags));

    const allowedSkills = Array.isArray(ALLOWED_SKILLS) ? ALLOWED_SKILLS.map(s => s.toLowerCase()) : [];
    const allowedTags   = Array.isArray(ALLOWED_TAGS)   ? ALLOWED_TAGS.map(t => t.toLowerCase())   : [];

    if (allowedSkills.length) requiredSkills = requiredSkills.filter((s) => allowedSkills.includes(s));
    if (allowedTags.length)   tags           = tags.filter((t) => allowedTags.includes(t));

    if (!requiredSkills.length) return res.status(400).json({ error: "At least one required skill is needed" });
    if (!tags.length)          return res.status(400).json({ error: "At least one tag is needed" });

    const attachments = (req.files || []).map((f) => ({
      name: f.originalname || "file",
      url:  f.path || f.secure_url || f.url || "",
      mime: f.mimetype,
      size: Number(f.size || 0),
      publicId: f.filename,
    }));

    const job = await Job.create({
      employerId, title, description, requiredSkills, tags,
      attachments, budget, acceptedPrice: null,
    });

    return res.json(job);
  } catch (e) {
    console.error("createJob error:", e);
    if (e?.name === "ValidationError") {
      const msgs = Object.values(e.errors || {}).map(err => err.message);
      return res.status(400).json({ error: msgs.join("; ") || "ValidationError" });
    }
    return res.status(500).json({ error: e?.message || "Internal Server Error" });
  }
};

/** List open jobs with filters */
export const listJobs = async (req, res) => {
  try {
    const { q, tags, minBudget, minEmployerRating } = req.query;
    let match = { status: "open" };

    if (q) {
      match.$or = [
        { title: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
        { requiredSkills: { $in: [new RegExp(q, "i")] } },
        { tags: { $in: [new RegExp(q, "i")] } },
      ];
    }

    // Support tags as repeated params (?tags=a&tags=b) or comma string
    let tagArray = [];
    if (Array.isArray(tags)) {
      tagArray = tags.flatMap((t) => String(t).split(",")).map((t) => t.trim().toLowerCase()).filter(Boolean);
    } else if (typeof tags === "string") {
      tagArray = String(tags).split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
    }
    if (tagArray.length) match.tags = { $all: tagArray };

    if (minBudget) match.budget = { $gte: Number(minBudget) || 0 };

    const pipeline = [
      { $match: match },
      {
        $lookup: {
          from: "users",
          localField: "employerId",
          foreignField: "_id",
          as: "employer",
          pipeline: [{ $project: { name: 1, ratingAvg: 1, ratingCount: 1 } }]
        },
      },
      { $unwind: "$employer" },
      // (Optional) filter by employer rating
      ...(minEmployerRating
        ? [{ $match: { "employer.ratingAvg": { $gte: parseFloat(minEmployerRating) || 0 } } }]
        : []),
      {
        $project: {
          _id: 1, title: 1, description: 1, requiredSkills: 1, tags: 1, attachments: 1,
          budget: 1, status: 1, createdAt: 1, employer: 1,
          // NEW: flat mirrors for convenience in UIs
          employerName: "$employer.name",
          employerRatingAvg: "$employer.ratingAvg",
          employerRatingCount: "$employer.ratingCount",
        },
      },
      { $sort: { createdAt: -1 } },
      { $limit: 100 },
    ];

    const jobs = await Job.aggregate(pipeline);
    res.json(jobs);
  } catch (e) {
    console.error("listJobs error:", e);
    res.status(500).json({ error: e.message });
  }
};

/** Get job by ID (return reviews + parties) */
export const getJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate({ path: "employerId", select: "name ratingAvg ratingCount skills" })
      .populate({ path: "assignedTo", select: "name ratingAvg ratingCount skills" })
      .lean();
    if (!job) return res.status(404).json({ error: "Not found" });

    const shaped = {
      ...job,
      employer: job.employerId ? {
        _id: job.employerId._id,
        name: job.employerId.name,
        ratingAvg: job.employerId.ratingAvg,
        ratingCount: job.employerId.ratingCount,
      } : null,
      freelancer: job.assignedTo ? {
        _id: job.assignedTo._id,
        name: job.assignedTo.name,
        ratingAvg: job.assignedTo.ratingAvg,
        ratingCount: job.assignedTo.ratingCount,
      } : null,
      employerName: job.employerId?.name,
      workerName: job.assignedTo?.name,

      // expose persisted reviews
      employerReview: job.employerReview || null,
      freelancerReview: job.freelancerReview || null,

      // legacy mirrors
      ratingEmployerToFreelancer: job.ratingEmployerToFreelancer || null,
      ratingFreelancerToEmployer: job.ratingFreelancerToEmployer || null,
    };

    res.json(shaped);
  } catch (e) {
    console.error("getJob error:", e);
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
    console.error("applyJob error:", e);
    res.status(500).json({ error: e.message });
  }
};

/** List applicants (employer only) */
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
    console.error("listApplicants error:", e);
    res.status(500).json({ error: e.message });
  }
};

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

    await Application.updateMany(
      { jobId, _id: { $ne: app._id } },
      { $set: { status: "rejected", rejectMessage: "Sorry! Already found a freelancer" } }
    );
    app.status = "accepted";
    await app.save();

    job.status = "assigned";
    job.assignedTo = app.freelancerId;
    job.acceptedPrice = Number(app.askPrice);
    job.freelancerConfirm = false;
    job.employerConfirm = false;
    job.escrowStatus = "unfunded";
    await job.save();

    let es = await Escrow.findOne({ jobId: job._id });
    if (!es) {
      await Escrow.create({
        jobId: job._id,
        employerId: job.employerId,
        freelancerId: job.assignedTo,
        amount: job.acceptedPrice ?? job.budget,
        status: "unfunded",
      });
    }

    res.json({
      ok: true,
      jobId: job._id,
      assignedTo: job.assignedTo,
      escrowRequired: true,
      agreedAmount: job.acceptedPrice,
    });
  } catch (e) {
    console.error("assignJob error:", e);
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
    console.error("getEscrow error:", e);
    res.status(500).json({ error: e.message });
  }
};

/** Fund escrow (employer only) */
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
      return res.json({ ok: true, status: "funded" });
    }

    es.status = "funded";
    await es.save();

    job.escrowStatus = "funded";
    await job.save();

    return res.json({ ok: true, status: "funded" });
  } catch (e) {
    console.error("fundEscrow error:", e);
    res.status(500).json({ error: e.message });
  }
};

/** Freelancer submits work */
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
  } catch (e) {
    console.error("submitWork error:", e);
    res.status(500).json({ error: e.message });
  }
};

/** Employer approves → release escrow → complete (optional one-shot employer review) */
export const approveWork = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ error: "Job not found" });
    if (String(job.employerId) !== req.user.sub) return res.status(403).json({ error: "Forbidden" });
    if (!job.freelancerConfirm) return res.status(400).json({ error: "Freelancer has not submitted yet" });

    job.employerConfirm = true;
    await job.save();

    try { await releaseEscrow(job._id); } catch (e) { console.warn("releaseEscrow:", e?.message || e); }

    job.status = "completed";
    job.escrowStatus = "released";
    job.approvedAt = new Date();
    job.completedAt = new Date();

    // Optional inline employer rating/comment with approval (immutable)
    const rating = Number(req.body?.score);
    const comment = String(req.body?.comment || "");
    if (Number.isFinite(rating) && rating >= 1 && rating <= 5) {
      if (job.employerReview) {
        // already rated previously → ignore silently to keep idempotence
      } else {
        job.employerReview = { rating, comment, createdAt: new Date() };
        job.ratingEmployerToFreelancer = { score: rating, comment, at: new Date() }; // mirror
        await bumpUserRating(job.assignedTo, rating);
      }
    }

    await job.save();
    res.json({ ok: true });
  } catch (e) {
    console.error("approveWork error:", e);
    res.status(500).json({ error: e.message });
  }
};

/** Ratings (immutable once set) */
export const rateJob = async (req, res) => {
  try {
    const rating = Number(req.body?.score);
    const comment = String(req.body?.comment || "");
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Score 1-5 required" });
    }

    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ error: "Job not found" });
    if (job.status !== "completed") return res.status(400).json({ error: "Job not completed" });

    const now = new Date();

    // Employer -> Worker (immutable)
    if (String(job.employerId) === req.user.sub) {
      if (job.employerReview || job.ratingEmployerToFreelancer) {
        return res.status(400).json({ error: "Already rated" });
      }
      job.employerReview = { rating, comment, createdAt: now };
      job.ratingEmployerToFreelancer = { score: rating, comment, at: now }; // mirror
      await job.save();
      await bumpUserRating(job.assignedTo, rating);
      return res.json({ ok: true });
    }

    // Worker -> Employer (immutable)
    if (String(job.assignedTo) === req.user.sub) {
      if (job.freelancerReview || job.ratingFreelancerToEmployer) {
        return res.status(400).json({ error: "Already rated" });
      }
      job.freelancerReview = { rating, comment, createdAt: now };
      job.ratingFreelancerToEmployer = { score: rating, comment, at: now }; // mirror
      await job.save();
      await bumpUserRating(job.employerId, rating);
      return res.json({ ok: true });
    }

    return res.status(403).json({ error: "Not part of this job" });
  } catch (e) {
    console.error("rateJob error:", e);
    res.status(500).json({ error: e.message });
  }
};

/** Chat access */
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
  } catch (e) {
    console.error("getMessages error:", e);
    res.status(500).json({ error: e.message });
  }
};

export const postMessage = async (req, res) => {
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
  } catch (e) {
    console.error("postMessage error:", e);
    res.status(500).json({ error: e.message });
  }
};

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
    return res.json({ ok: true, tip });
  } catch (e) { return res.status(500).json({ error: e.message }); }
};
