import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiSearchUsers } from "../lib/api";
import "../styles/people.css";

const initialsOf = (name = "") =>
  name.trim().split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase()).join("") || "U";

const timeAgo = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d2 = Math.floor(h / 24);
  if (d2 < 7) return `${d2}d ago`;
  return d.toLocaleDateString();
};

export default function People() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState([]);
  const [page, setPage] = useState(1);
  const [firstLoad, setFirstLoad] = useState(true);
  const controllerRef = useRef(null);

  const load = async (p = 1, term = q) => {
    // cancel previous request (best-effort)
    try { controllerRef.current?.abort(); } catch {}
    controllerRef.current = new AbortController();

    setLoading(true);
    try {
      const data = await apiSearchUsers(term, p, 20);
      if (p === 1) setList(data);
      else setList(prev => [...prev, ...data]);
      setPage(p);
    } catch (e) {
      // Axios doesn't support AbortController directly without adapter, so ignore aborts
      if (!String(e).includes("canceled")) {
        alert(e?.response?.data?.error || "Failed to search users");
      }
    } finally {
      setLoading(false);
      setFirstLoad(false);
    }
  };

  // Debounced search on query change
  useEffect(() => {
    const t = setTimeout(() => load(1, q.trim()), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // Initial load
  useEffect(() => { load(1, ""); /* first render */ }, []); // eslint-disable-line

  const hasResults = list.length > 0;

  return (
    <div className="container" style={{ maxWidth: 980 }}>
      <div className="people-header">
        <h2 className="h2">People</h2>
        <div className="people-search">
          <input
            className="input people-search-input"
            placeholder="Search by name or email…"
            value={q}
            onChange={(e)=>setQ(e.target.value)}
          />
          <button
            className="btn btn-primary"
            onClick={()=>load(1, q.trim())}
            disabled={loading}
            aria-label="Search"
          >
            {loading ? "Searching…" : "Search"}
          </button>
        </div>
      </div>

      {/* Meta line */}
      {!firstLoad && (
        <div className="people-meta muted">
          {hasResults
            ? <>Showing <strong>{list.length}</strong> result{list.length !== 1 ? "s" : ""}{q ? <> for <em>“{q}”</em></> : null}</>
            : q ? <>No results for <em>“{q}”</em></> : <>No users found.</>}
        </div>
      )}

      {/* Grid */}
      <div className="people-grid">
        {(firstLoad || loading) && list.length === 0 ? (
          // Skeletons (initial)
          Array.from({ length: 8 }).map((_, i) => (
            <div className="person-card skeleton" key={i}>
              <div className="person-head">
                <div className="avatar ring" />
                <div className="person-nameline">
                  <div className="skeleton-line w-60" />
                  <div className="skeleton-line w-40" />
                </div>
              </div>
              <div className="person-meta">
                <span className="role-pill skeleton-pill" />
                <span className="muted skeleton-line w-40" />
              </div>
            </div>
          ))
        ) : hasResults ? (
          list.map(u => (
            <Link key={u._id} to={`/u/${u._id}`} className="person-card">
              <div className="person-head">
                <div className="avatar ring" aria-hidden="true">
                  {initialsOf(u.name)}
                </div>
                <div className="person-nameline">
                  <div className="person-name">{u.name || "User"}</div>
                  <div className="muted person-sub">{u.email}</div>
                </div>
              </div>

              <div className="person-meta">
                <span className={`role-pill role-${u.role || "user"}`}>
                  {String(u.role || "user").replace(/^\w/, c => c.toUpperCase())}
                </span>
                <span className="muted" title={u.createdAt ? new Date(u.createdAt).toLocaleString() : ""}>
                  Joined {timeAgo(u.createdAt)}
                </span>
              </div>
            </Link>
          ))
        ) : (
          // Empty state (after search)
          !loading && (
            <div className="people-empty">
              <div className="people-empty-icon" aria-hidden>👀</div>
              <div className="people-empty-title">No users found</div>
              <div className="people-empty-sub">Try a different name, email, or clear the search.</div>
            </div>
          )
        )}
      </div>

      {/* Load more */}
      {hasResults && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
          <button className="btn btn-outline" onClick={()=>load(page + 1, q.trim())} disabled={loading}>
            {loading ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
