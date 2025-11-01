import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Wallet from "../models/Wallet.js";

export async function ensureAdmin() {
  const username = (process.env.ADMIN_USERNAME || "").trim();
  const password = (process.env.ADMIN_PASSWORD || "").trim();
  if (!username || !password) {
    console.warn("⚠️ ADMIN_USERNAME / ADMIN_PASSWORD missing in .env");
    return null;
  }

  const email = `${username}@local.admin`.toLowerCase();
  const uname = username.toLowerCase();

  // Find by username OR email (avoid duplicates)
  let admin = await User.findOne({ $or: [{ username: uname }, { email }] });

  if (!admin) {
    const passwordHash = await bcrypt.hash(password, 10);
    admin = await User.create({
      name: username,
      username: uname,
      email,
      role: "admin",
      passwordHash,
      skills: [],
    });
    console.log(`👑 Admin ensured: ${admin.username}`);
  } else if (admin.role !== "admin") {
    admin.role = "admin";
    await admin.save();
    console.log(`👑 Existing user promoted to admin: ${admin.username}`);
  }

  // Ensure company wallet for this admin
  let cw = await Wallet.findOne({ ownerId: admin._id, type: "company" });
  if (!cw) {
    cw = await Wallet.create({
      ownerId: admin._id,
      type: "company",
      holding: 0,
      profitTotal: 0,
      balance: 0,
    });
    console.log("💼 Company wallet created.");
  }

  return admin;
}
