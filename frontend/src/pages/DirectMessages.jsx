import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../store/auth";
import {
  apiDMConversations,
  apiDMMessages,
  apiSendDM,
  apiSearchUsers,
} from "../lib/api";
import { markThreadSeen, getConvoUnread } from "../lib/dmRead";
import "../styles/chat.css";

/* Helpers */
const idOf = (v) => (v && typeof v === "object" ? v._id || v.id || null : v || null);
const sid = (v) => (v == null ? "" : String(v));
const initials = (name = "") =>
  (String(name).trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("") || "U").toUpperCase();
const sameDay = (a, b) => {
  const da = new Date(a), db = new Date(b);
  return da.getFullYear() === db.getFullYear()
    && da.getMonth() === db.getMonth()
    && da.getDate() === db.getDate();
};
const groupByDay = (messages) => {
  const out = []; let current = null;
  for (const m of messages) {
    if (!current || !sameDay(current.date, m.createdAt)) {
      current = { date: m.createdAt, items: [] }; out.push(current);
    }
    current.items.push(m);
  }
  return out;
};

/* ============================== DM LIST ============================== */
export function DMList() {
  const { user } = useAuth();
  const myId = useMemo(() => sid(idOf(user?._id) || idOf(user?.id)), [user]);

  const [convos, setConvos] = useState([]);
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try { setConvos(await apiDMConversations()); }
      catch (e) { console.error(e); }
    })();
  }, []);

  const runSearch = async () => {
    setLoading(true);
    try { setResults(await apiSearchUsers(q, 1, 20)); }
    catch (e) { alert(e?.response?.data?.error || "Failed to search users"); }
    finally { setLoading(false); }
  };

  return (
    <div className="container dm-wrap">
      <div className="dm-card">
        <div className="dm-header">
          <div className="dm-title">Messages</div>
        </div>

        {/* People search inside messages */}
        <div className="dm-search">
          <input
            className="input"
            placeholder="Search people to message…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") runSearch(); }}
          />
          <button className="btn btn-primary" onClick={runSearch} disabled={loading}>
            {loading ? "Searching…" : "Search"}
          </button>
        </div>

        {results.length > 0 && (
          <div className="dm-section">
            <div className="dm-section-title">People</div>
            <div className="dm-people-list">
              {results.map((u) => (
                <Link key={u._id} to={`/dm/${u._id}`} className="dm-user-row">
                  <div className="avatar-sm">{initials(u.name)}</div>
                  <div className="dm-user-meta">
                    <div className="dm-user-name">{u.name}</div>
                    <div className="muted">{u.email} • {u.role}</div>
                  </div>
                  <div className="dm-user-action">
                    <span className="btn btn-outline">Message</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="dm-section">
          <div className="dm-section-title">Conversations</div>
          {convos.length === 0 && <div className="muted">No conversations yet.</div>}
          <div className="dm-people-list">
            {convos.map((c) => {
              const unread = getConvoUnread(c, myId);
              return (
                <Link
                  key={c.peer._id}
                  to={`/dm/${c.peer._id}`}
                  className={`dm-user-row ${unread > 0 ? "unread" : ""}`}
                >
                  <div className="avatar-sm">{initials(c.peer.name)}</div>
                  <div className="dm-user-meta">
                    <div className="dm-user-name">
                      {c.peer.name}
                      {unread > 0 && <span className="badge-dot">• {typeof c.unread === "number" ? c.unread : unread}</span>}
                    </div>
                    <div className="muted truncate">{c.last?.text || "No messages yet"}</div>
                  </div>
                  <div className="dm-time">
                    {c.last?.createdAt ? new Date(c.last.createdAt).toLocaleString() : ""}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
export function DMChat() {
  const { user } = useAuth();
  const myId = useMemo(() => sid(idOf(user?._id) || idOf(user?.id)), [user]);
  const { userId } = useParams();
  const navigate = useNavigate();

  const [peer, setPeer] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");

  // paging
  const PAGE_SIZE = 30;
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const scrollRef = useRef(null);

  // ---- helpers ----
  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  };

  const markSeenIfNeeded = (list) => {
    const last = list.length ? list[list.length - 1] : null;
    if (!last?.createdAt) return;
    const lastFrom = sid(idOf(last.from));
    if (!myId || lastFrom === myId) return; // my own outgoing — skip
    markThreadSeen(userId, last.createdAt);
  };

  // ---- initial load (latest page) ----
  const loadInitial = async () => {
    setLoadingInitial(true);
    try {
      const res = await apiDMMessages(userId, 1, PAGE_SIZE);
      let list = [];
      if (Array.isArray(res)) {
        list = res;
      } else {
        setPeer(res.peer || null);
        list = Array.isArray(res.messages) ? res.messages : [];
      }

      setMsgs(list);           // chronological already (your API reverses before returning)
      setPage(1);
      setHasMore(list.length === PAGE_SIZE);
      // mark seen & position to bottom
      markSeenIfNeeded(list);
    } catch (e) {
      alert(e?.response?.data?.error || "Failed to load chat");
    } finally {
      setLoadingInitial(false);
      // next tick to ensure DOM is painted
      setTimeout(scrollToBottom, 0);
    }
  };

  useEffect(() => { if (userId) loadInitial(); }, [userId]);

  // ---- load older (prepend) ----
  const loadOlder = async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);

    const el = scrollRef.current;
    const prevScrollHeight = el ? el.scrollHeight : 0;

    try {
      const nextPage = page + 1;
      const res = await apiDMMessages(userId, nextPage, PAGE_SIZE);
      let list = [];
      if (Array.isArray(res)) {
        list = res;
      } else {
        list = Array.isArray(res.messages) ? res.messages : [];
      }

      // Prepend older messages (list is chronological)
      setMsgs(prev => [...list, ...prev]);
      setPage(nextPage);
      setHasMore(list.length === PAGE_SIZE);

      // Maintain scroll position after prepending
      requestAnimationFrame(() => {
        const el2 = scrollRef.current;
        if (!el2) return;
        const newScrollHeight = el2.scrollHeight;
        el2.scrollTop = newScrollHeight - prevScrollHeight;
      });
    } catch (e) {
      alert(e?.response?.data?.error || "Failed to load older messages");
    } finally {
      setLoadingMore(false);
    }
  };

  // ---- scroll listener (load older when near top) ----
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onScroll = () => {
      if (el.scrollTop <= 120) {
        loadOlder();
      }
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, hasMore, loadingMore]);

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    try {
      await apiSendDM(userId, t);
      setText("");
      // Optimistic append (so it feels instant)
      const now = new Date().toISOString();
      setMsgs(prev => [...prev, {
        _id: `tmp-${now}`,
        text: t,
        from: myId,
        to: userId,
        createdAt: now
      }]);
      // Scroll to bottom to show sent message
      requestAnimationFrame(scrollToBottom);

      // Optional: refresh the latest page to replace tmp id (not strictly required)
      // await loadInitial();
      markThreadSeen(userId, now);
    } catch (e) {
      alert(e?.response?.data?.error || "Failed to send");
    }
  };

  const grouped = useMemo(() => groupByDay(msgs), [msgs]);

  return (
    <div className="container dm-wrap">
      <div className="dm-card dm-fixed">
        {/* Header */}
        <div className="dm-header">
          <button className="btn btn-outline" onClick={() => navigate("/dm")}>← Back</button>
          <div className="dm-title">{peer ? peer.name : "Chat"}</div>
          <div />
        </div>

        {/* Messages area (fixed-height, scrollable) */}
        <div className="dm-body" ref={scrollRef}>
          {loadingInitial && <div className="muted">Loading…</div>}
          {!loadingInitial && msgs.length === 0 && <div className="muted">No messages yet.</div>}

          {/* Loading older indicator at top */}
          {loadingMore && (
            <div className="dm-loader-top">Loading earlier messages…</div>
          )}

          {grouped.map((g, idx) => (
            <div key={idx}>
              <div className="dm-sep">
                <span>{new Date(g.date).toLocaleDateString()}</span>
              </div>

              {g.items.map((m) => {
                const fromId = sid(idOf(m.from));
                const mine = myId && fromId && myId === fromId;
                const name = m.from?.name || m.fromName || (mine ? "You" : peer?.name || "User");
                const time = new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                return (
                  <div key={m._id || `${fromId}-${m.createdAt}`} className={`dm-row ${mine ? "me" : "them"}`}>
                    {!mine && <div className="avatar-sm">{initials(name)}</div>}
                    <div className="dm-bubble">
                      {!mine && <div className="dm-bubble-name">{name}</div>}
                      <div className="dm-bubble-text">{m.text}</div>
                      <div className="dm-bubble-time">{time}</div>
                    </div>
                    {mine && <div className="avatar-sm me-badge">👤</div>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Composer */}
        <div className="dm-composer">
          <input
            className="input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a message…"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          />
          <button className="btn btn-primary" onClick={send}>Send</button>
        </div>
      </div>
    </div>
  );
}
