// frontend/src/pages/CoursePlayer.jsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../lib/api";

export default function CoursePlayer() {
  const { id } = useParams();
  const [modules, setModules] = useState([]);
  const [current, setCurrent] = useState(null);

  const load = async () => {
    const { data } = await api.get(`/courses/${id}/lessons`);
    const mods = data?.modules || [];
    setModules(mods);
    const first = mods[0]?.lessons?.[0] || null;
    if (first?.videoUrl) setCurrent(first);
  };

  useEffect(() => { load(); }, [id]);

  return (
    <div className="container">
      <div className="detail-header">
        <div className="detail-title">Course Player</div>
      </div>

      <div className="detail-body">
        <div className="card">
          {current?.videoUrl ? (
            <video
              key={current._id}
              controls
              style={{ width: "100%", borderRadius: 8, background: "#000" }}
              src={current.videoUrl}
            />
          ) : (
            <div className="muted">Select a lesson to start</div>
          )}
          {current && (
            <div style={{ marginTop: 8, fontWeight: 700 }}>{current.title}</div>
          )}
        </div>

        <div className="sidebar">
          <div className="panel">
            <b>Lessons</b>
            <div className="mt-2">
              {modules.map(m => (
                <div key={m._id} style={{ marginBottom: 10 }}>
                  <div style={{ fontWeight: 700 }}>{m.title}</div>
                  <ul style={{ marginLeft: 14, marginTop: 6 }}>
                    {m.lessons.map(l => (
                      <li key={l._id}>
                        <button
                          className="btn btn-outline"
                          style={{ padding: "6px 10px", marginTop: 6 }}
                          onClick={() => setCurrent(l)}
                          disabled={!l.videoUrl}
                          title={l.videoUrl ? "Play" : "Not available"}
                        >
                          {l.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {modules.length === 0 && <div className="muted">No lessons.</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
