// frontend/src/pages/CourseDetails.jsx
import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../store/auth";

export default function CourseDetails() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [course, setCourse] = useState(null);
  const [lessons, setLessons] = useState(null); // public titles or full (if authorized)
  const [msg, setMsg] = useState("");

  const load = async () => {
    const [{ data: c }, { data: l }] = await Promise.all([
      api.get(`/courses/${id}`),
      user ? api.get(`/courses/${id}/lessons`) : Promise.resolve({ data: { modules: [] } }),
    ]);
    setCourse(c);
    setLessons(l?.modules || []);
  };

  useEffect(() => { load(); }, [id]);

  const buy = async () => {
    setMsg("");
    try {
      await api.post(`/courses/${id}/buy`);
      setMsg("Purchased! Opening player…");
      setTimeout(() => nav(`/courses/${id}/player`), 600);
    } catch (e) {
      setMsg(e?.response?.data?.error || "Failed to buy");
    }
  };

  if (!course) return <div className="container">Loading…</div>;
  const authedHasVideo = (lessons || []).some(m => (m.lessons || []).some(l => l.videoUrl));

  return (
    <div className="container">
      <div className="detail-header">
        <div className="detail-title">{course.title}</div>
        <span className="badge">${course.price}</span>
      </div>

      {course.thumbnail?.url && (
        <img src={course.thumbnail.url} alt="cover" style={{ width: "100%", maxHeight: 360, objectFit: "cover", borderRadius: 12, marginBottom: 12 }} />
      )}

      <div className="panel">
        <b>About</b>
        <p className="mt-2">{course.description}</p>

        <div className="job-meta" style={{ marginTop: 8 }}>
          <span className="job-tag">{course.category}</span>
          {(course.tags || []).map(t => <span key={t} className="job-tag">{t}</span>)}
        </div>
      </div>

      <div className="panel" style={{ marginTop: 12 }}>
        <b>Curriculum</b>
        <div className="mt-2">
          {(lessons || []).map(m => (
            <div key={m._id} style={{ marginBottom: 8 }}>
              <div style={{ fontWeight: 700 }}>{m.title}</div>
              <ul style={{ marginLeft: 16, marginTop: 6 }}>
                {m.lessons.map(l => <li key={l._id}>{l.title}</li>)}
              </ul>
            </div>
          ))}
          {(lessons || []).length === 0 && <div className="muted">No lessons yet.</div>}
        </div>
      </div>

      <div className="row" style={{ gap: 8, marginTop: 12 }}>
        {authedHasVideo ? (
          <Link className="btn btn-primary" to={`/courses/${course._id}/player`}>Open Player</Link>
        ) : (
          <button className="btn btn-primary" onClick={buy}>Buy & Watch</button>
        )}
        <Link className="btn btn-outline" to="/courses">Back</Link>
      </div>

      {msg && <div className="mt-2 muted">{msg}</div>}
    </div>
  );
}
