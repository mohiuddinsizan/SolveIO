import express from "express";

// Auth & profile
import { register, login, me } from "../controllers/auth.controller.js";
import { getMyProfile, updateMySkills } from "../controllers/user.controller.js";

// Meta (rigid lists)
import { getMeta } from "../controllers/meta.controller.js";

// Jobs flow
import {
  createJob,
  listJobs,
  getJob,
  applyJob,
  listApplicants,
  assignJob,
  submitWork,
  approveWork,
  rateJob,
} from "../controllers/jobs.controller.js";

// Stats
import {
  employerStats,
  freelancerStats,
  adminStats,
} from "../controllers/stats.controller.js";

// Orders
import {
  employerOrders,
  freelancerOrders,
} from "../controllers/orders.controller.js";

// Chat (job-scoped)
import {
  listMessages,
  postMessage,
} from "../controllers/chat.controller.js";

// Escrow
import {
  fundEscrow,
  getEscrow,
  tipFreelancer,
} from "../controllers/escrow.controller.js";

// Middleware
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";

export const router = express.Router();

// ----- Health -----
router.get("/ping", (_req, res) => res.json({ pong: true }));

// ----- Auth -----
router.post("/auth/register", register);
router.post("/auth/login", login);
router.get("/me", requireAuth, me);

// ----- Meta -----
router.get("/meta", getMeta);

// ----- Jobs (public + protected) -----
router.get("/jobs", listJobs);
router.get("/jobs/:id", getJob);
router.post("/jobs", requireAuth, requireRole("employer"), createJob);

router.get("/jobs/:id/applicants", requireAuth, requireRole("employer"), listApplicants);
router.post("/jobs/:id/assign", requireAuth, requireRole("employer"), assignJob);

router.post("/jobs/:id/apply", requireAuth, requireRole("worker"), applyJob);

// ----- Profile -----
router.get("/me/profile", requireAuth, getMyProfile);
router.put("/me/skills", requireAuth, requireRole("worker"), updateMySkills);

// ----- Escrow -----
router.get("/jobs/:id/escrow", requireAuth, getEscrow);
router.post("/jobs/:id/escrow/fund", requireAuth, requireRole("employer"), fundEscrow);

// ----- Work flow -----
router.post("/jobs/:id/submit", requireAuth, requireRole("worker"), submitWork);
router.post("/jobs/:id/approve", requireAuth, requireRole("employer"), approveWork);
router.post("/jobs/:id/rate", requireAuth, rateJob);

// ----- Stats -----
router.get("/stats/employer", requireAuth, requireRole("employer"), employerStats);
router.get("/stats/freelancer", requireAuth, requireRole("worker"), freelancerStats);
router.get("/stats/admin", requireAuth, requireRole("admin"), adminStats);

// ----- Orders -----
router.get("/orders/employer", requireAuth, requireRole("employer"), employerOrders);
router.get("/orders/freelancer", requireAuth, requireRole("worker"), freelancerOrders);

// ----- Chat (job-scoped) -----
router.get("/jobs/:id/messages", requireAuth, listMessages);
router.post("/jobs/:id/messages", requireAuth, postMessage);

// ----- Tips (after completion) -----
router.post("/jobs/:id/tip", requireAuth, requireRole("employer"), tipFreelancer);

