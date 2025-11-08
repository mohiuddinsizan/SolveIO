import express from "express";

// Auth & profile
import { register, login, me } from "../controllers/auth.controller.js";
import { getMyProfile, updateMySkills } from "../controllers/user.controller.js";

// Meta
import { getMeta } from "../controllers/meta.controller.js";

import { aiFindJobs } from "../controllers/aiJobsSearch.controller.js";


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

// Social
import {
  followUser, unfollowUser, listFollowers, listFollowing, isFollowing,
  createPost, feed, postsByUser, reactPost, commentPost,
  listDMConversations, listDMMessages, sendDM
} from "../controllers/social.controller.js";


import {
  createCourse,
  setCourseThumbnail,
  createModule,
  addVideo,
  createFullCourse,
  listCourses,
  getCourse,
  buyCourse,
  myCourses,
} from "../controllers/courses.controller.js";

import { upload, uploadVideo, uploadMixedCourseFull } from "../utils/upload.js";


// Stats
import {
  employerStats,
  freelancerStats,
  adminStats,
} from "../controllers/stats.controller.js";


import { aiSkillDevelopment } from "../controllers/aiSkillDev.controller.js";

import { getUserPublic, searchUsers } from "../controllers/usersPublic.controller.js";



// Orders
import { employerOrders, freelancerOrders } from "../controllers/orders.controller.js";

// Chat (job-scoped)
import { listMessages, postMessage } from "../controllers/chat.controller.js";

// Escrow
import { fundEscrow, getEscrow, tipFreelancer } from "../controllers/escrow.controller.js";

// Middleware
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";


// AI
import { aiChat, aiGenerateJob } from "../controllers/ai.controller.js";

const router = express.Router();

/* ------------------------------ Health ------------------------------ */
router.get("/ping", (_req, res) => res.json({ pong: true }));

/* ------------------------------- Auth -------------------------------- */
router.post("/auth/register", register);
router.post("/auth/login", login);
router.get("/me", requireAuth, me);

/* -------------------------------- Meta ------------------------------- */
router.get("/meta", getMeta);

/* ------------------------- Jobs (public/protected) ------------------- */
router.get("/jobs", listJobs);
router.get("/jobs/:id", getJob);

router.post(
  "/jobs",
  requireAuth,
  requireRole("employer"),
  upload.array("attachments", 5), // ← uses Cloudinary or disk from utils/upload.js
  createJob
);

router.get(
  "/jobs/:id/applicants",
  requireAuth,
  requireRole("employer"),
  listApplicants
);
router.post(
  "/jobs/:id/assign",
  requireAuth,
  requireRole("employer"),
  assignJob
);
router.post("/jobs/:id/apply", requireAuth, requireRole("worker"), applyJob);

/* ------------------------------ Profile ----------------------------- */
router.get("/me/profile", requireAuth, getMyProfile);
router.put("/me/skills", requireAuth, requireRole("worker"), updateMySkills);

/* ------------------------------- Escrow ------------------------------ */
router.get("/jobs/:id/escrow", requireAuth, getEscrow);
router.post(
  "/jobs/:id/escrow/fund",
  requireAuth,
  requireRole("employer"),
  fundEscrow
);

/* ---------------------------- Work flow ------------------------------ */
router.post(
  "/jobs/:id/submit",
  requireAuth,
  requireRole("worker"),
  submitWork
);
router.post(
  "/jobs/:id/approve",
  requireAuth,
  requireRole("employer"),
  approveWork
);
router.post("/jobs/:id/rate", requireAuth, rateJob);

/* ------------------------------- Stats ------------------------------- */
router.get(
  "/stats/employer",
  requireAuth,
  requireRole("employer"),
  employerStats
);
router.get(
  "/stats/freelancer",
  requireAuth,
  requireRole("worker"),
  freelancerStats
);
router.get("/stats/admin", requireAuth, requireRole("admin"), adminStats);

/* ------------------------------- Orders ------------------------------ */
router.get(
  "/orders/employer",
  requireAuth,
  requireRole("employer"),
  employerOrders
);
router.get(
  "/orders/freelancer",
  requireAuth,
  requireRole("worker"),
  freelancerOrders
);

/* --------------------------- Chat (job-scoped) ----------------------- */
router.get("/jobs/:id/messages", requireAuth, listMessages);
router.post("/jobs/:id/messages", requireAuth, postMessage);

/* ---------------------------- Tips (after) --------------------------- */
router.post(
  "/jobs/:id/tip",
  requireAuth,
  requireRole("employer"),
  tipFreelancer
);

/* -------------------------------- AI --------------------------------- */
router.post("/ai/chat", requireAuth, aiChat);
router.post("/ai/generate", requireAuth, requireRole("employer"), aiGenerateJob);
router.post("/ai/find-jobs", aiFindJobs); // public; leave /ai/chat and /ai/generate as-is

router.get("/ai/skill-development", requireAuth, requireRole("worker"), aiSkillDevelopment);






/* ------------------------------- Courses ------------------------------- */
router.get("/courses", listCourses);
router.get("/courses/:id", requireAuth, getCourse);
router.get("/my/courses", requireAuth, myCourses);

// step flow (optional keep)
router.post("/courses", requireAuth, requireRole("worker"), createCourse);
router.put(
  "/courses/:id/thumbnail",
  requireAuth,
  requireRole("worker"),
  upload.single("thumbnail"),
  setCourseThumbnail
);
router.post(
  "/courses/:id/modules",
  requireAuth,
  requireRole("worker"),
  createModule
);
router.post(
  "/courses/:id/modules/:mIndex/videos",
  requireAuth,
  requireRole("worker"),
  uploadVideo.single("video"),
  addVideo
);

// unified all-in-one creation (title + thumbnail + modules+lectures)
router.post(
  "/courses/full",
  requireAuth,
  requireRole("worker"),
  uploadMixedCourseFull.any(),
  createFullCourse
);

// purchase with code ("syncpmo")
router.post("/courses/:id/buy", requireAuth, buyCourse);


/* ------------------------------- Social ------------------------------- */
// Follow graph
router.post("/social/follow/:userId", requireAuth, followUser);
router.delete("/social/follow/:userId", requireAuth, unfollowUser);
router.get("/social/followers/:userId", requireAuth, listFollowers);
router.get("/social/following/:userId", requireAuth, listFollowing);
router.get("/social/is-following/:userId", requireAuth, isFollowing);

// Posts & feed
router.post("/social/posts", requireAuth, upload.array("images", 5), createPost);
router.get("/social/feed", requireAuth, feed);
router.get("/social/posts/user/:userId", requireAuth, postsByUser);
router.post("/social/posts/:id/react", requireAuth, reactPost);
router.post("/social/posts/:id/comment", requireAuth, commentPost);

// Direct messages
router.get("/social/dm", requireAuth, listDMConversations);
router.get("/social/dm/:userId", requireAuth, listDMMessages);
router.post("/social/dm/:userId", requireAuth, sendDM);


router.get("/users/:id", requireAuth, getUserPublic);

// Public user read/search (auth required to keep consistent with your app)
router.get("/users/:id", requireAuth, getUserPublic);
router.get("/users", requireAuth, searchUsers); // /users?q=alice&page=1&limit=20

export default router;

