
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";


// Helper to mint tokens
function issueToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d"
  });
}

export const register = async (req, res) => {
  try {
    const { email, name, password, role } = req.body;

    // Block any attempt to create admin accounts from public API
    if (role === "admin") {
      return res.status(403).json({ error: "Admin signup is not allowed" });
    }

    if (!email || !name || !password || !role) {
      return res.status(400).json({ error: "Missing fields" });
    }
    if (!["worker", "employer"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: "Email already exists" });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ email, name, passwordHash, role });

    const token = issueToken({ sub: user._id, role: user.role });
    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};


export const login = async (req, res) => {
  try {
    const { identifier, username, email, password } = req.body;
    const idStr = (identifier || username || email || "").trim();

    if (!idStr || !password) {
      return res.status(400).json({ error: "Missing credentials" });
    }

    // 1) ENV ADMIN (no DB record required)
    const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

    if (ADMIN_USERNAME && ADMIN_PASSWORD && idStr === ADMIN_USERNAME) {
      if (password !== ADMIN_PASSWORD) {
        return res.status(400).json({ error: "Invalid credentials" });
      }
      const adminUser = {
        _id: "000000000000000000000000", // dummy ObjectId-like string
        name: ADMIN_USERNAME,
        email: `admin@${ADMIN_USERNAME}.local`,
        role: "admin",
      };
      const token = issueToken({
        sub: adminUser._id,
        id: adminUser._id,
        role: adminUser.role,
        name: adminUser.name,
        email: adminUser.email,
      });
      return res.json({ token, user: adminUser });
    }

    // 2) NORMAL USERS (DB)
    const user = await User.findOne({
      $or: [{ email: idStr }, { name: idStr }],
    });

    if (!user) return res.status(400).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash || "");
    if (!ok) return res.status(400).json({ error: "Invalid credentials" });

    const token = issueToken({
      sub: String(user._id),
      id: String(user._id),
      role: user.role,
      name: user.name,
      email: user.email,
    });

    return res.json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (e) {
    console.error("login error:", e);
    res.status(500).json({ error: e.message || "Internal error" });
  }
};


export const me = async (req, res) => {
  try {
    res.json({ user: { id: req.user.sub, role: req.user.role } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
