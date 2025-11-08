// backend/src/utils/upload.js
import multer from "multer";
import path from "path";
import fs from "fs";

import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";

// -------------------- Common paths --------------------
export const STATIC_UPLOAD_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(STATIC_UPLOAD_DIR)) fs.mkdirSync(STATIC_UPLOAD_DIR, { recursive: true });

// -------------------- Cloudinary toggle --------------------
const USE_CLOUDINARY =
  !!process.env.CLOUDINARY_CLOUD_NAME &&
  !!process.env.CLOUDINARY_API_KEY &&
  !!process.env.CLOUDINARY_API_SECRET;

// -------------------- IMAGES/DOCS (existing) --------------------
const ALLOWED_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const fileFilter = (_req, file, cb) => {
  if (!ALLOWED_MIMES.has(file.mimetype)) return cb(new Error("Unsupported file type"), false);
  cb(null, true);
};

let storage;

if (USE_CLOUDINARY) {
  try {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });

    const folder = process.env.CLOUDINARY_FOLDER || "solveio/jobs";

    storage = new CloudinaryStorage({
      cloudinary,
      params: async (_req, file) => {
        const safe = (file.originalname || "file").replace(/[^\w.\-]+/g, "_");
        return {
          folder,
          public_id: `${Date.now().toString(36)}-${safe}`,
          use_filename: true,
          unique_filename: false,
          overwrite: false,
          resource_type: "auto", // keep “auto” for images/docs
        };
      },
    });

    // eslint-disable-next-line no-console
    console.log("📸 Using Cloudinary storage for images/docs");
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("Cloudinary misconfigured, falling back to disk:", err?.message);
  }
}

if (!storage) {
  // Fallback to disk if cloudinary is missing or misconfigured
  storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, STATIC_UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const safe = (file.originalname || "file").replace(/[^\w.\-]+/g, "_");
      const stamp = Date.now().toString(36);
      cb(null, `${stamp}-${safe}`);
    },
  });
  // eslint-disable-next-line no-console
  console.log("💾 Using local disk storage at /uploads for images/docs");
}

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
});

// -------------------- VIDEOS (local for FFmpeg) --------------------
const VIDEO_MIMES = new Set([
  "video/mp4",
  "video/quicktime",  // .mov
  "video/x-matroska", // .mkv
  "video/webm",
  "application/octet-stream", // some browsers label unknown .mp4 as octet-stream
]);

const videoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, STATIC_UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const safe = (file.originalname || "video").replace(/[^\w.\-]+/g, "_");
    const stamp = Date.now().toString(36);
    cb(null, `${stamp}-${safe}`);
  },
});

const videoFilter = (_req, file, cb) => {
  if (!VIDEO_MIMES.has(file.mimetype)) return cb(new Error("Unsupported video type"), false);
  cb(null, true);
};

export const uploadVideo = multer({
  storage: videoStorage,
  fileFilter: videoFilter,
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024, // up to 2GB
    files: 1,
  },
});

// -------------------- MIXED for /courses/full --------------------
// Accept BOTH video and image fields together; store on disk.
// Controller will upload thumbnail to Cloudinary and keep videos local for ffmpeg.
const MIXED_MIMES = new Set([...ALLOWED_MIMES, ...VIDEO_MIMES]);

const mixedStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, STATIC_UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const safe = (file.originalname || "file").replace(/[^\w.\-]+/g, "_");
    const stamp = Date.now().toString(36);
    cb(null, `${stamp}-${safe}`);
  },
});

const mixedFilter = (_req, file, cb) => {
  if (!MIXED_MIMES.has(file.mimetype)) return cb(new Error("Unsupported file type"), false);
  cb(null, true);
};

export const uploadMixedCourseFull = multer({
  storage: mixedStorage,
  fileFilter: mixedFilter,
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024, // allow big files for videos
  },
});
