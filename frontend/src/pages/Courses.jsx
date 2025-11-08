import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiListCourses } from "../lib/api";
import "../styles/courses.css";

export default function Courses() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const debouncedQ = useDebounce(q, 250);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const data = await apiListCourses(debouncedQ);
        if (alive) setItems(data || []);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [debouncedQ]);

  return (
    <div className="courses">
      <div className="container">
        <div className="section-title">
          <h1 className="h2">Courses</h1>
          <div className="row" style={{ flex: 1, marginLeft: 12 }}>
            <input
              className="input"
              placeholder="Search title or description…"
              aria-label="Search courses"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ width: "100%" }}
            />
          </div>
        </div>

        {loading && <p className="muted">Loading…</p>}
        {!loading && items.length === 0 && <p className="muted">No courses yet.</p>}

        <div className="course-grid" role="list">
          {items.map((c) => (
            <Link key={c._id} to={`/courses/${c._id}`} className="course-card" role="listitem">
              <img className="course-thumb" src={c.thumbnailUrl || "/logo.png"} alt={c.title} loading="lazy" />
              <div>
                <div className="course-title">{c.title}</div>
                <div className="course-desc">{c.description}</div>
              </div>
              <div className="course-meta">
                <span className="badge">{(c.priceCents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" })}</span>
                <span className="pill">{c?.creator?.name || "Creator"}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function useDebounce(value, delay = 200) {
  const [v, setV] = useState(value);
  const t = useRef();
  useEffect(() => {
    clearTimeout(t.current);
    t.current = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t.current);
  }, [value, delay]);
  return v;
}