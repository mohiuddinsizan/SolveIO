import multer from "multer";
import { v2 as cloudinary } from "cloudinary";

const mem = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1024 * 1024 * 1024 } }); // up to 1GB

// cloudinary is configured in app.js

export const uploadThumb = [
  mem.single("file"),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file" });

      const up = await cloudinary.uploader.upload_stream(
        { folder: "syncpmo/course_thumbs", resource_type: "image", format: "jpg" },
        (err, result) => {
          if (err) return res.status(500).json({ error: err.message });
          return res.json({
            publicId: result.public_id,
            url: result.secure_url,
          });
        }
      );

      // pipe buffer
      const s = up;
      s.end(req.file.buffer);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
];

export const uploadVideo = [
  mem.single("file"),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file" });

      const up = await cloudinary.uploader.upload_stream(
        { folder: "syncpmo/course_videos", resource_type: "video" },
        (err, result) => {
          if (err) return res.status(500).json({ error: err.message });
          return res.json({
            publicId: result.public_id,
            url: result.secure_url,
            duration: Math.round(result.duration || 0),
          });
        }
      );

      const s = up;
      s.end(req.file.buffer);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
];
