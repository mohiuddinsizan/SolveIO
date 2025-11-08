import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

/**
 * STRICT auth: 401 if missing/invalid. Normalizes req.user to always have:
 *   {_id, id, sub, role}
 */
export function requireAuth(req, res, next) {
  const header = String(req.headers.authorization || "");
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "No token" });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    // normalize shape so downstream code is stable
    const uid = payload.sub || payload.id || payload._id;
    if (!uid) return res.status(401).json({ error: "Invalid token (no subject)" });

    req.user = {
      ...payload,
      _id: uid,
      id: uid,
      sub: uid,
      role: payload.role || "worker",
    };
    return next();
  } catch (e) {
    const msg = e?.name === "TokenExpiredError" ? "Token expired" : "Invalid token";
    return res.status(401).json({ error: msg });
  }
}

/**
 * OPTIONAL auth: never 401s. If token valid, attaches req.user (normalized).
 * Use this before public routes so a stale token doesn't break them.
 */
export function optionalAuth(req, _res, next) {
  const header = String(req.headers.authorization || "");
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return next();

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const uid = payload.sub || payload.id || payload._id;
    if (uid) {
      req.user = {
        ...payload,
        _id: uid,
        id: uid,
        sub: uid,
        role: payload.role || "worker",
      };
    }
  } catch {
    // swallow errors: public routes must not fail due to bad tokens
  }
  return next();
}

/** Role gate (still needs requireAuth upstream for protected routes) */
export const requireRole = (role) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  if (String(req.user.role) !== String(role) && req.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
};
