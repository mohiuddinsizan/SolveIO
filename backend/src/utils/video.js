import path from "path";
import fs from "fs";
import fsp from "fs/promises";
import ffmpeg from "fluent-ffmpeg";
import { STATIC_UPLOAD_DIR } from "./upload.js";

if (process.env.FFMPEG_PATH) ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
if (process.env.FFPROBE_PATH) ffmpeg.setFfprobePath(process.env.FFPROBE_PATH);

/* ---------------------------- helpers ---------------------------- */
async function ensureDir(absDir) {
  await fsp.mkdir(absDir, { recursive: true });
}
function toWebPath(absPath) {
  const rel = path.relative(STATIC_UPLOAD_DIR, absPath).replace(/\\/g, "/");
  return `/uploads/${rel}`;
}
function probeDuration(absPath) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(absPath, (err, data) => {
      if (err || !data || !data.format) return resolve(0);
      const dur = Number(data.format.duration);
      resolve(Number.isFinite(dur) ? dur : 0);
    });
  });
}
async function safeStat(absPath) {
  try { const st = await fsp.stat(absPath); return st.size ?? 0; }
  catch { return 0; }
}

/**
 * Transcode to MP4 + (optional) HLS.
 * If transcode fails, DO NOT rename/copy as .mp4; keep original file/extension as the playable URL.
 * Returns web paths under /uploads and a non-zero duration when possible.
 *
 * @returns {Promise<{ mp4Path: string|null, hlsPlaylistPath: string|null, durationSec: number, sizeBytes: number, originalAbs: string }>}
 */
export async function transcodeVideoToMp4AndHls(inputAbs, outRelDir) {
  const outAbsDir = path.join(STATIC_UPLOAD_DIR, outRelDir);
  await ensureDir(outAbsDir);

  const inputExt = (path.extname(inputAbs) || "").toLowerCase(); // e.g. .webm, .mov, .mp4
  const outMp4Abs = path.join(outAbsDir, "video.mp4");
  const outHlsAbs = path.join(outAbsDir, "master.m3u8");

  let mp4Ok = false;
  let hlsOk = false;

  // Try to transcode -> MP4 (H.264/AAC). If ffmpeg is missing or fails, we'll fall back to original.
  try {
    await new Promise((resolve, reject) => {
      ffmpeg(inputAbs)
        .outputOptions([
          "-c:v libx264",
          "-preset veryfast",
          "-crf 23",
          "-pix_fmt yuv420p",
          "-movflags +faststart",
          "-c:a aac",
          "-b:a 128k",
          "-ac 2",
          "-ar 48000",
        ])
        .format("mp4")
        .on("error", reject)
        .on("end", resolve)
        .save(outMp4Abs);
    });
    mp4Ok = true;
  } catch {
    mp4Ok = false;
  }

  // Only produce HLS when we have a confirmed MP4
  if (mp4Ok) {
    try {
      await new Promise((resolve, reject) => {
        ffmpeg(outMp4Abs)
          .outputOptions([
            "-profile:v baseline",
            "-level 3.0",
            "-start_number 0",
            "-hls_time 4",
            "-hls_list_size 0",
            "-f hls",
          ])
          .on("error", reject)
          .on("end", resolve)
          .save(outHlsAbs);
      });
      hlsOk = true;
    } catch {
      hlsOk = false;
    }
  }

  // Duration — prefer output mp4, then input
  let durationSec = 0;
  if (mp4Ok) durationSec = await probeDuration(outMp4Abs);
  if (!durationSec || durationSec < 0.5) {
    const fallback = await probeDuration(inputAbs);
    if (fallback > durationSec) durationSec = fallback;
  }
  durationSec = Math.round(durationSec || 0);

  // Size
  const sizeBytes = await safeStat(mp4Ok ? outMp4Abs : inputAbs);

  // Web paths
  const mp4Path = mp4Ok ? toWebPath(outMp4Abs) : null;
  const hlsPlaylistPath = mp4Ok && hlsOk ? toWebPath(outHlsAbs) : null;

  return {
    mp4Path,                // null when no valid mp4; frontend/db must use originalPath (kept in controller)
    hlsPlaylistPath,        // null if HLS skipped
    durationSec,
    sizeBytes,
    originalAbs: inputAbs,  // controller already stores originalPath web URL
  };
}
