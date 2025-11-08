import mongoose from "mongoose";
import User from "../models/User.js";
import SocialPost from "../models/SocialPost.js";
import SocialFollow from "../models/SocialFollow.js";
import SocialDMMessage from "../models/SocialDM.js";

/* ------------------------------ Helpers ------------------------------ */
const sid = (v) => (v == null ? null : String(v));
const objId = (v) =>
  (mongoose.isValidObjectId(v) ? new mongoose.Types.ObjectId(v) : null);

// Map an uploaded file (multer/cloud storage) to your imageSchema shape
const fileToImage = (f) => {
  if (!f) return null;
  const url =
    f.path ||          // cloudinary via multer-storage-cloudinary often sets .path
    f.secure_url ||    // cloudinary explicit
    f.location ||      // S3 via multer-s3
    (f.filename ? `/uploads/${f.filename}` : null); // local disk (served statically)
  if (!url) return null;
  return {
    url,
    mime: f.mimetype,
    bytes: typeof f.size === "number" ? f.size : undefined,
    publicId: f.public_id || f.publicId,
    width: f.width,
    height: f.height,
  };
};

/* ------------------------------- Follow ------------------------------ */
export const followUser = async (req, res) => {
  try {
    const me = sid(req.user?.sub);
    const target = sid(req.params.userId);
    if (!me || !objId(me)) return res.status(401).json({ error: "Unauthorized" });
    if (!objId(target)) return res.status(400).json({ error: "Invalid user id" });
    if (me === target) return res.status(400).json({ error: "You cannot follow yourself" });

    await SocialFollow.updateOne(
      { followerId: me, followingId: target },
      { $setOnInsert: { followerId: me, followingId: target } },
      { upsert: true }
    );
    return res.json({ ok: true });
  } catch (e) { return res.status(500).json({ error: e.message }); }
};

export const unfollowUser = async (req, res) => {
  try {
    const me = sid(req.user?.sub);
    const target = sid(req.params.userId);
    if (!me || !objId(me)) return res.status(401).json({ error: "Unauthorized" });
    if (!objId(target)) return res.status(400).json({ error: "Invalid user id" });

    await SocialFollow.deleteOne({ followerId: me, followingId: target });
    return res.json({ ok: true });
  } catch (e) { return res.status(500).json({ error: e.message }); }
};

export const listFollowers = async (req, res) => {
  try {
    const target = sid(req.params.userId);
    if (!objId(target)) return res.status(400).json({ error: "Invalid user id" });

    const rows = await SocialFollow.find({ followingId: target })
      .populate("followerId", "name email role ratingAvg ratingCount")
      .sort({ createdAt: -1 })
      .lean();

    res.json(rows.map(r => ({
      _id: r._id,
      user: {
        _id: r.followerId._id,
        name: r.followerId.name,
        email: r.followerId.email,
        role: r.followerId.role,
        ratingAvg: r.followerId.ratingAvg,
        ratingCount: r.followerId.ratingCount
      },
      followedAt: r.createdAt,
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const listFollowing = async (req, res) => {
  try {
    const target = sid(req.params.userId);
    if (!objId(target)) return res.status(400).json({ error: "Invalid user id" });

    const rows = await SocialFollow.find({ followerId: target })
      .populate("followingId", "name email role ratingAvg ratingCount")
      .sort({ createdAt: -1 })
      .lean();

    res.json(rows.map(r => ({
      _id: r._id,
      user: {
        _id: r.followingId._id,
        name: r.followingId.name,
        email: r.followingId.email,
        role: r.followingId.role,
        ratingAvg: r.followingId.ratingAvg,
        ratingCount: r.followingId.ratingCount
      },
      followedAt: r.createdAt,
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const isFollowing = async (req, res) => {
  try {
    const me = sid(req.user?.sub);
    const target = sid(req.params.userId);
    if (!me || !objId(me)) return res.status(401).json({ error: "Unauthorized" });
    if (!objId(target)) return res.status(400).json({ error: "Invalid user id" });

    const exists = await SocialFollow.exists({ followerId: me, followingId: target });
    res.json({ following: !!exists });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

/* -------------------------------- Posts ------------------------------ */
export const createPost = async (req, res) => {
  try {
    const me = sid(req.user?.sub);
    if (!me || !objId(me)) return res.status(401).json({ error: "Unauthorized" });

    const text = String(req.body?.text || "").trim();
    const files = Array.isArray(req.files) ? req.files : [];
    const images = files.map(fileToImage).filter(Boolean);

    if (!text && images.length === 0) {
      return res.status(400).json({ error: "Post must include text or at least one image." });
    }

    const post = await SocialPost.create({ authorId: me, text, images });
    const populated = await SocialPost.findById(post._id)
      .populate("authorId", "name email role")
      .lean();

    res.json({
      _id: populated._id,
      text: populated.text,
      images: populated.images || [],
      author: {
        _id: populated.authorId._id,
        name: populated.authorId.name,
        email: populated.authorId.email,
        role: populated.authorId.role
      },
      reactionsCount: 0,
      commentsCount: 0,
      createdAt: populated.createdAt,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const feed = async (req, res) => {
  try {
    const me = sid(req.user?.sub);
    if (!me || !objId(me)) return res.status(401).json({ error: "Unauthorized" });

    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 20)));
    const skip = (page - 1) * limit;

    const followingRows = await SocialFollow.find({ followerId: me }).select("followingId").lean();
    const followingIds = followingRows.map(r => r.followingId);

    const rows = await SocialPost.find({
      $or: [{ authorId: { $in: followingIds } }, { authorId: objId(me) }],
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("authorId", "name email role")
      .populate("comments.userId", "name email role")
      .lean();

    res.json(rows.map(p => ({
      _id: p._id,
      text: p.text,
      images: p.images || [],
      author: {
        _id: p.authorId._id,
        name: p.authorId.name,
        email: p.authorId.email,
        role: p.authorId.role
      },
      reactionsCount: p.reactions?.length || 0,
      commentsCount: p.comments?.length || 0,
      comments: (p.comments || []).map(c => ({
        _id: c._id,
        text: c.text,
        createdAt: c.createdAt,
        user: c.userId ? {
          _id: c.userId._id,
          name: c.userId.name,
          email: c.userId.email,
          role: c.userId.role,
        } : undefined,
      })),
      createdAt: p.createdAt,
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const postsByUser = async (req, res) => {
  try {
    const u = sid(req.params.userId);
    if (!objId(u)) return res.status(400).json({ error: "Invalid user id" });

    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 20)));
    const skip = (page - 1) * limit;

    const rows = await SocialPost.find({ authorId: u })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("authorId", "name email role")
      .populate("comments.userId", "name email role")
      .lean();

    res.json(rows.map(p => ({
      _id: p._id,
      text: p.text,
      images: p.images || [],
      author: {
        _id: p.authorId._id,
        name: p.authorId.name,
        email: p.authorId.email,
        role: p.authorId.role
      },
      reactionsCount: p.reactions?.length || 0,
      commentsCount: p.comments?.length || 0,
      comments: (p.comments || []).map(c => ({
        _id: c._id,
        text: c.text,
        createdAt: c.createdAt,
        user: c.userId ? {
          _id: c.userId._id,
          name: c.userId.name,
          email: c.userId.email,
          role: c.userId.role,
        } : undefined,
      })),
      createdAt: p.createdAt,
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const reactPost = async (req, res) => {
  try {
    const me = sid(req.user?.sub);
    const { id } = req.params;
    if (!me || !objId(me)) return res.status(401).json({ error: "Unauthorized" });
    if (!objId(id)) return res.status(400).json({ error: "Invalid post id" });

    const post = await SocialPost.findById(id);
    if (!post) return res.status(404).json({ error: "Post not found" });

    const idx = (post.reactions || []).findIndex(r => String(r.userId) === me);
    if (idx >= 0) {
      post.reactions.splice(idx, 1); // toggle off
    } else {
      post.reactions.push({ userId: objId(me), type: "like" });
    }
    await post.save();

    res.json({ ok: true, reactionsCount: post.reactions.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const commentPost = async (req, res) => {
  try {
    const me = sid(req.user?.sub);
    const { id } = req.params;
    const text = String(req.body?.text || "").trim();
    if (!me || !objId(me)) return res.status(401).json({ error: "Unauthorized" });
    if (!objId(id)) return res.status(400).json({ error: "Invalid post id" });
    if (!text) return res.status(400).json({ error: "Comment text required" });

    const post = await SocialPost.findById(id);
    if (!post) return res.status(404).json({ error: "Post not found" });

    post.comments.push({ userId: objId(me), text });
    await post.save();

    res.json({ ok: true, commentsCount: post.comments.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

/* -------------------------------- DMs -------------------------------- */
export const listDMConversations = async (req, res) => {
  try {
    const me = sid(req.user?.sub);
    if (!me || !objId(me)) return res.status(401).json({ error: "Unauthorized" });

    // last message per peer
    const rows = await SocialDMMessage.aggregate([
      { $match: { $or: [{ from: objId(me) }, { to: objId(me) }] } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: {
            peer: {
              $cond: [{ $eq: ["$from", objId(me)] }, "$to", "$from"],
            },
          },
          lastMessage: { $first: "$$ROOT" },
        },
      },
      { $sort: { "lastMessage.createdAt": -1 } },
      { $limit: 50 },
    ]);

    const peerIds = rows.map(r => r._id.peer);
    const users = await User.find({ _id: { $in: peerIds } }).select("name email role").lean();
    const userMap = new Map(users.map(u => [String(u._id), u]));

    res.json(rows.map(r => ({
      peer: userMap.get(String(r._id.peer)),
      last: {
        text: r.lastMessage.text,
        createdAt: r.lastMessage.createdAt,
        from: String(r.lastMessage.from),
        to: String(r.lastMessage.to),
      }
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const listDMMessages = async (req, res) => {
  try {
    const me = sid(req.user?.sub);
    const peer = sid(req.params.userId);
    if (!me || !objId(me)) return res.status(401).json({ error: "Unauthorized" });
    if (!objId(peer)) return res.status(400).json({ error: "Invalid peer id" });

    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 50)));
    const skip = (page - 1) * limit;

    const rows = await SocialDMMessage.find({
      $or: [
        { from: objId(me), to: objId(peer) },
        { from: objId(peer), to: objId(me) },
      ],
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.json(rows.reverse()); // chronological
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const sendDM = async (req, res) => {
  try {
    const me = sid(req.user?.sub);
    const peer = sid(req.params.userId);
    const text = String(req.body?.text || "").trim();

    if (!me || !objId(me)) return res.status(401).json({ error: "Unauthorized" });
    if (!objId(peer)) return res.status(400).json({ error: "Invalid peer id" });
    if (!text) return res.status(400).json({ error: "Message text required" });

    const m = await SocialDMMessage.create({ from: objId(me), to: objId(peer), text });
    res.json({ ok: true, message: { _id: m._id, text: m.text, from: m.from, to: m.to, createdAt: m.createdAt } });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
