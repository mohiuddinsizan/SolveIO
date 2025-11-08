// backend/src/controllers/courses.controller.js
import path from "path";
import fs from "fs";
import Course from "../models/Course.js";
import CoursePurchase from "../models/CoursePurchase.js";
import { transcodeVideoToMp4AndHls } from "../utils/video.js";
import { v2 as cloudinary } from "cloudinary";

/* --------------------------- helpers --------------------------- */
function getId(val) {
  // Works for both ObjectId and populated documents
  return (val && (val._id || val)) ? String(val._id || val) : "";
}

function canView(user, course, purchase) {
  const isFree = (course?.priceCents ?? 0) === 0;

  // Not logged in: only free courses are viewable
  if (!user) return isFree;

  const userId = String(user._id || user.id || user.sub || "");
  const creatorId = getId(course?.creator);

  if (creatorId && creatorId === userId) return true; // creator
  if (user.role === "admin") return true;             // admin
  if (purchase) return true;                          // purchased
  if (isFree) return true;                            // free
  return false;
}

/* -------------------- keep your simple create -------------------- */
export async function createCourse(req, res) {
  try {
    const { title, description, priceCents, tags } = req.body;
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const creatorId = req.user._id || req.user.id || req.user.sub;
    if (!creatorId) return res.status(401).json({ error: "Invalid token payload (no user id)" });

    if (!title || !description || priceCents == null) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const course = await Course.create({
      title,
      description,
      priceCents: Number(priceCents),
      creator: creatorId,
      tags: Array.isArray(tags) ? tags : [],
      modules: [{ title: "Module 1", order: 0, videos: [] }],
    });

    return res.status(201).json(course);
  } catch (err) {
    console.error("createCourse error:", err);
    res.status(500).json({ error: "Failed to create course", detail: err.message });
  }
}

export async function setCourseThumbnail(req, res) {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ error: "Not found" });
    if (getId(course.creator) !== getId(req.user) && req.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (!req.file) return res.status(400).json({ error: "Missing thumbnail" });

    const up = await cloudinary.uploader.upload(req.file.path, {
      folder: process.env.CLOUDINARY_FOLDER || "solveio/courses",
      resource_type: "image",
    });
    course.thumbnailUrl = up.secure_url;
    await course.save();
    try { fs.unlinkSync(req.file.path); } catch {}

    res.json({ ok: true, course });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to set thumbnail" });
  }
}

export async function createModule(req, res) {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ error: "Not found" });
    if (getId(course.creator) !== getId(req.user) && req.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }
    const { title, order = course.modules.length } = req.body;
    if (!title) return res.status(400).json({ error: "Missing title" });
    course.modules.push({ title, order, videos: [] });
    await course.save();
    res.status(201).json(course);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create module" });
  }
}

/* ------------------------------------------------------------------ */
/*  step-flow single video upload -> Cloudinary (fallback FFmpeg)     */
/* ------------------------------------------------------------------ */
export async function addVideo(req, res) {
  try {
    const { id, mIndex } = req.params;
    const course = await Course.findById(id);
    if (!course) return res.status(404).json({ error: "Not found" });
    if (getId(course.creator) !== getId(req.user) && req.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }
    const idx = Number(mIndex);
    if (!(idx >= 0) || !course.modules[idx]) {
      return res.status(400).json({ error: "Invalid module index" });
    }
    if (!req.file) return res.status(400).json({ error: "Missing video file" });

    const { title, description = "", order = course.modules[idx].videos.length } = req.body;

    let videoDoc;
    const haveCloudinary =
      !!process.env.CLOUDINARY_CLOUD_NAME &&
      !!process.env.CLOUDINARY_API_KEY &&
      !!process.env.CLOUDINARY_API_SECRET;

    if (haveCloudinary) {
      const up = await cloudinary.uploader.upload(req.file.path, {
        folder: `${process.env.CLOUDINARY_FOLDER || "solveio/courses"}/${course._id}/m${idx}`,
        resource_type: "video",
        eager: [{ format: "mp4" }],
        eager_async: false,
      });

      const mp4Url = (up.eager && up.eager[0]?.secure_url) || up.secure_url;
      videoDoc = {
        title: title || req.file.originalname,
        description,
        order: Number(order),
        originalPath: up.secure_url,
        mp4Path: mp4Url,
        hlsPlaylistPath: null,
        durationSec: Math.round(up.duration || 0),
        sizeBytes: up.bytes || 0,
        url: mp4Url,
      };

      try { fs.unlinkSync(req.file.path); } catch {}
    } else {
      const outRelDir = path.join("videos", "courses", String(course._id), `m${idx}`, String(Date.now()));
      const absInput = req.file.path;

      const { mp4Path, hlsPlaylistPath, durationSec, sizeBytes } =
        await transcodeVideoToMp4AndHls(absInput, outRelDir);

      const originalPath = "/uploads/" + path.basename(absInput);
      const url = mp4Path || originalPath;

      videoDoc = {
        title: title || req.file.originalname,
        description,
        order: Number(order),
        originalPath,
        mp4Path,
        hlsPlaylistPath,
        durationSec,
        sizeBytes,
        url,
      };
    }

    course.modules[idx].videos.push(videoDoc);
    await course.save();
    res.status(201).json({ ok: true, course });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add video", detail: err.message });
  }
}

/* ------------------------------------------------------------------ */
/*  unified full creation -> Cloudinary for ALL lecture files          */
/* ------------------------------------------------------------------ */
export async function createFullCourse(req, res) {
  try {
    const { title, description, price, priceCents, metadata } = req.body;
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const creatorId = req.user._id || req.user.id || req.user.sub;
    if (!creatorId) return res.status(401).json({ error: "Invalid token payload (no user id)" });
    if (!title || !description) return res.status(400).json({ error: "Missing required fields" });

    const filesArr = Array.isArray(req.files) ? req.files : [];
    const byField = new Map();
    for (const f of filesArr) byField.set(f.fieldname, f);

    const cents = priceCents != null
      ? Number(priceCents)
      : Math.round(parseFloat(price || "0") * 100);

    const course = await Course.create({
      title,
      description,
      priceCents: Number.isFinite(cents) ? cents : 0,
      creator: creatorId,
      modules: [],
    });

    // Thumbnail
    const t = byField.get("thumbnail");
    if (t) {
      const up = await cloudinary.uploader.upload(t.path, {
        folder: process.env.CLOUDINARY_FOLDER || "solveio/courses",
        resource_type: "image",
      });
      course.thumbnailUrl = up.secure_url;
      try { fs.unlinkSync(t.path); } catch {}
    }

    const haveCloudinary =
      !!process.env.CLOUDINARY_CLOUD_NAME &&
      !!process.env.CLOUDINARY_API_KEY &&
      !!process.env.CLOUDINARY_API_SECRET;

    const meta = metadata ? JSON.parse(metadata) : [];
    for (let mIndex = 0; mIndex < meta.length; mIndex++) {
      const modMeta = meta[mIndex] || {};
      const mod = { title: modMeta.title || `Module ${mIndex + 1}`, order: mIndex, videos: [] };

      const lectures = Array.isArray(modMeta.lectures) ? modMeta.lectures : [];
      for (let lIndex = 0; lIndex < lectures.length; lIndex++) {
        const key = `video_${mIndex}_${lIndex}`;
        const f = byField.get(key);
        if (!f) continue;

        if (haveCloudinary) {
          const up = await cloudinary.uploader.upload(f.path, {
            folder: `${process.env.CLOUDINARY_FOLDER || "solveio/courses"}/${course._id}/m${mIndex}`,
            resource_type: "video",
            eager: [{ format: "mp4" }],
            eager_async: false,
          });

          const mp4Url = (up.eager && up.eager[0]?.secure_url) || up.secure_url;

          mod.videos.push({
            title: lectures[lIndex]?.title || f.originalname,
            description: lectures[lIndex]?.description || "",
            order: lIndex,
            originalPath: up.secure_url,
            mp4Path: mp4Url,
            hlsPlaylistPath: null,
            durationSec: Math.round(up.duration || 0),
            sizeBytes: up.bytes || 0,
            url: mp4Url,
          });

          try { fs.unlinkSync(f.path); } catch {}
        } else {
          const outRelDir = path.join("videos", "courses", String(course._id), `m${mIndex}`, String(Date.now()));
          const absInput = f.path;

          const { mp4Path, hlsPlaylistPath, durationSec, sizeBytes } =
            await transcodeVideoToMp4AndHls(absInput, outRelDir);

          const originalPath = "/uploads/" + path.basename(absInput);
          const url = mp4Path || originalPath;

          mod.videos.push({
            title: lectures[lIndex]?.title || f.originalname,
            description: lectures[lIndex]?.description || "",
            order: lIndex,
            originalPath,
            mp4Path,
            hlsPlaylistPath,
            durationSec,
            sizeBytes,
            url,
          });
        }
      }

      course.modules.push(mod);
    }

    await course.save();
    res.status(201).json({ ok: true, course });
  } catch (err) {
    console.error("createFullCourse error:", err);
    res.status(500).json({ error: "Failed to create full course", detail: err.message });
  }
}

/* --------------------------- list / view / buy --------------------------- */
export async function listCourses(req, res) {
  try {
    const { q = "", page = 1, limit = 20 } = req.query;
    const find = q ? { $text: { $search: q }, isPublished: true } : { isPublished: true };
    const docs = await Course.find(find)
      .select("title description priceCents thumbnailUrl creator createdAt modules")
      .populate("creator", "name role")
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    // Provide lightweight module/lecture counts (handy for pre-purchase UI)
    const enriched = docs.map(d => ({
      _id: d._id,
      title: d.title,
      description: d.description,
      priceCents: d.priceCents,
      thumbnailUrl: d.thumbnailUrl,
      creator: d.creator,
      createdAt: d.createdAt,
      moduleCount: (d.modules || []).length,
      lectureCount: (d.modules || []).reduce((n, m) => n + (m.videos?.length || 0), 0),
    }));

    res.json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to list courses" });
  }
}

export async function getCourse(req, res) {
  try {
    // Public endpoint: no auth required to preview details
    const user = req.user || null; // may be undefined if route is public
    const course = await Course.findById(req.params.id).populate("creator", "name role _id");
    if (!course) return res.status(404).json({ error: "Not found" });

    let purchase = null;
    if (user?._id) {
      purchase = await CoursePurchase.findOne({ user: user._id, course: course._id });
    }

    const allowed = canView(user, course, purchase);
    const safe = course.toObject();

    // ALWAYS expose course high-level details to buyer (even if not purchased)
    // — title, description, price, thumbnail, modules with per-lecture title+description+duration
    if (!allowed) {
      safe.modules = (safe.modules || []).map(m => ({
        _id: m._id,
        title: m.title,
        order: m.order,
        videos: (m.videos || []).map(v => ({
          _id: v._id,
          title: v.title,
          description: v.description || "", // show description pre-purchase
          durationSec: v.durationSec || 0,  // show duration pre-purchase
          order: v.order,
          locked: true,                     // still locked (no URLs)
        })),
      }));
      // Strip ONLY streaming/file fields if they exist
      // (we already reconstructed videos above without url/mp4/hls)
    } else {
      // Viewer has access: ensure locked=false
      safe.modules = (safe.modules || []).map(m => ({
        ...m,
        videos: (m.videos || []).map(v => ({ ...v, locked: false })),
      }));
    }

    const youAreCreator = getId(course.creator) === getId(user);
    const youAreAdmin = user?.role === "admin";

    res.json({
      course: safe,
      canView: allowed,
      purchased: !!purchase,
      youAreCreator,
      youAreAdmin,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to get course" });
  }
}

export async function buyCourse(req, res) {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ error: "Not found" });
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    // creator/admin already have access
    if (getId(course.creator) === getId(req.user) || req.user.role === "admin") {
      return res.status(200).json({ ok: true, message: "Access already granted (creator/admin)" });
    }

    // free course shouldn't require purchase
    if ((course.priceCents ?? 0) === 0) {
      return res.status(200).json({ ok: true, message: "Free course — no purchase required" });
    }

    const { code } = req.body || {};
    if (code !== "syncpmo") {
      return res.status(400).json({ error: "Invalid purchase code" });
    }

    const purchase = await CoursePurchase.findOneAndUpdate(
      { user: req.user._id, course: course._id },
      { $setOnInsert: { priceCents: course.priceCents } },
      { new: true, upsert: true }
    );

    res.status(201).json({ ok: true, message: "Course purchased successfully!", purchase });
  } catch (err) {
    console.error("buyCourse error:", err);
    res.status(500).json({ error: "Failed to purchase", detail: err.message });
  }
}

export async function myCourses(req, res) {
  try {
    const created = await Course.find({ creator: req.user._id })
      .select("title description thumbnailUrl priceCents createdAt");

    const purchases = await CoursePurchase.find({ user: req.user._id })
      .populate({ path: "course", select: "title description thumbnailUrl priceCents creator" });

    res.json({
      created,
      purchased: purchases.map(p => p.course),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load my courses" });
  }
}
