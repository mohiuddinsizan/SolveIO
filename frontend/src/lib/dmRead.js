// frontend/src/lib/dmRead.js
const KEY = "dm:lastSeen"; // { [peerId]: ISOString }

function loadMap() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
function saveMap(map) {
  try { localStorage.setItem(KEY, JSON.stringify(map)); } catch {}
}

const idOf = (v) => (v && typeof v === "object" ? v._id || v.id || null : v || null);
const sid = (v) => (v == null ? "" : String(v));

/** Mark a thread as read up to lastTs (ISOString/Date/number) */
export function markThreadSeen(peerId, lastTs) {
  if (!peerId || !lastTs) return;
  const map = loadMap();
  const iso = new Date(lastTs).toISOString();
  if (!map[peerId] || new Date(iso) > new Date(map[peerId])) {
    map[peerId] = iso;
    saveMap(map);
  }
}

/** Unread count for a single convo (0/1 unless server provides numeric) */
export function getConvoUnread(convo, myId) {
  if (!convo) return 0;
  if (typeof convo.unread === "number") return convo.unread;

  const peerId = sid(convo?.peer?._id);
  const last = convo?.last;
  if (!peerId || !last?.createdAt) return 0;

  const lastFrom = sid(idOf(last.from));
  // Don't count your own outgoing message as unread
  if (myId && lastFrom === myId) return 0;

  const seenMap = loadMap();
  const seen = seenMap[peerId];
  if (!seen) return 1; // never opened before and last is from peer

  return new Date(last.createdAt) > new Date(seen) ? 1 : 0;
}

/** Total unread across convos */
export function getUnreadFromConvos(convos, myId) {
  if (!Array.isArray(convos) || convos.length === 0) return 0;
  return convos.reduce((sum, c) => sum + getConvoUnread(c, myId), 0);
}
