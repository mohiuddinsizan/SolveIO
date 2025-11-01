import Job from "../models/Job.js";
import Message from "../models/Message.js";

const canAccess = (job, user) => {
  if (!job) return false;
  if (!job.assignedTo) return false; // chat ONLY after assignment
  const isEmployerOwner = String(job.employerId) === user.sub;
  const isAssignedWorker = String(job.assignedTo) === user.sub;
  return isEmployerOwner || isAssignedWorker;
};

export const listMessages = async (req, res) => {
  const job = await Job.findById(req.params.id).lean();
  if (!job) return res.status(404).json({ error: "Job not found" });
  if (!job.assignedTo) return res.status(400).json({ error: "Chat available after assignment" });
  if (!canAccess(job, req.user)) return res.status(403).json({ error: "Forbidden" });

  const msgs = await Message.find({ jobId: job._id }).sort({ createdAt: 1 }).lean();
  res.json(msgs);
};

export const postMessage = async (req, res) => {
  const { text } = req.body;
  const job = await Job.findById(req.params.id).lean();
  if (!job) return res.status(404).json({ error: "Job not found" });
  if (!job.assignedTo) return res.status(400).json({ error: "Chat available after assignment" });
  if (!canAccess(job, req.user)) return res.status(403).json({ error: "Forbidden" });
  if (!text || !text.trim()) return res.status(400).json({ error: "Text required" });

  const recipient =
    String(req.user.sub) === String(job.employerId) ? job.assignedTo :
    String(req.user.sub) === String(job.assignedTo) ? job.employerId : null;
  if (!recipient) return res.status(400).json({ error: "No valid recipient" });

  const msg = await Message.create({ jobId: job._id, from: req.user.sub, to: recipient, text: text.trim() });
  res.json(msg);
};
