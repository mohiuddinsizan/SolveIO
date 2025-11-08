import User from "../models/User.js";

export const getUserPublic = async (req, res) => {
  try {
    const u = await User.findById(req.params.id)
      .select("name email role createdAt")
      .lean();
    if (!u) return res.status(404).json({ error: "Not found" });
    res.json(u);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const searchUsers = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 20)));
    const skip = (page - 1) * limit;

    const match = q
      ? {
          $or: [
            { name:  { $regex: q, $options: "i" } },
            { email: { $regex: q, $options: "i" } },
          ],
        }
      : {};

    const rows = await User.find(match)
      .select("name email role createdAt")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
};
