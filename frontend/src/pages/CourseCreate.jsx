import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import "../styles/courses.css";

export default function CourseCreate() {
  const nav = useNavigate();

  const [title, setTitle] = useState("");
  const [priceUsd, setPriceUsd] = useState("");
  const [desc, setDesc] = useState("");
  const [thumb, setThumb] = useState(null);

  const [modules, setModules] = useState([{ title: "Module 1", lectures: [] }]);
  const [submitting, setSubmitting] = useState(false);

  const addModule = () =>
    setModules([...modules, { title: `Module ${modules.length + 1}`, lectures: [] }]);

  const addLecture = (mi) => {
    const next = [...modules];
    next[mi].lectures.push({ title: "", description: "", file: null });
    setModules(next);
  };

  const setLectureField = (mi, li, field, value) => {
    const next = [...modules];
    next[mi].lectures[li][field] = value;
    setModules(next);
  };

  async function submit() {
    if (!title.trim() || !desc.trim()) {
      return alert("Title & description are required");
    }
    const form = new FormData();
    form.append("title", title.trim());
    form.append("description", desc.trim());
    form.append("price", String(priceUsd || "0")); // USD; backend converts to cents
    if (thumb) form.append("thumbnail", thumb);

    const meta = modules.map(m => ({
      title: m.title,
      lectures: m.lectures.map(l => ({ title: l.title, description: l.description })),
    }));
    form.append("metadata", JSON.stringify(meta));

    modules.forEach((m, mi) => {
      m.lectures.forEach((l, li) => {
        if (l.file) form.append(`video_${mi}_${li}`, l.file);
      });
    });

    setSubmitting(true);
    try {
      const res = await api.post("/courses/full", form);
      alert("Course created successfully!");
      nav(`/courses/${res.data.course._id}`);
    } catch (e) {
      alert(e?.response?.data?.error || "Failed to create course");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="courses">
      <div className="container">
        <div className="section-title">
          <div className="h2">Create Course</div>
        </div>

        <div className="form-grid">
          <div className="panel">
            <div className="col">
              <label className="muted">Title</label>
              <input className="input" value={title} onChange={(e)=>setTitle(e.target.value)} />

              <label className="muted">Description (used for search)</label>
              <textarea className="input" rows={5} value={desc} onChange={(e)=>setDesc(e.target.value)} />

              <label className="muted">Price (USD)</label>
              <input className="input" type="number" min="0" step="0.01" value={priceUsd} onChange={(e)=>setPriceUsd(e.target.value)} />
            </div>
          </div>

          <div className="panel">
            <label className="thumb-uploader">
              <input type="file" accept="image/*" onChange={(e)=>setThumb(e.target.files?.[0] || null)} />
              {thumb ? "Thumbnail selected" : "Click to upload thumbnail (Cloudinary)"}
            </label>
            {thumb && <img className="thumb-preview" src={URL.createObjectURL(thumb)} alt="thumb" />}
          </div>
        </div>

        <div className="panel" style={{ marginTop: 16 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div className="h2" style={{ fontSize: 20 }}>Modules & Lectures</div>
            <button className="btn btn-outline" onClick={addModule}>+ Add Module</button>
          </div>

          <div className="curriculum" style={{ marginTop: 12 }}>
            {modules.map((m, mi) => (
              <div className="module" key={mi}>
                <div className="module-head">
                  <input
                    className="input"
                    value={m.title}
                    onChange={(e)=> {
                      const next = [...modules];
                      next[mi].title = e.target.value;
                      setModules(next);
                    }}
                  />
                  <button className="btn btn-outline" onClick={()=>addLecture(mi)}>+ Lecture</button>
                </div>

                <div className="module-body">
                  {m.lectures.map((l, li) => (
                    <div className="lesson" key={li}>
                      <div className="left">
                        <input
                          className="input"
                          placeholder="Lecture title"
                          value={l.title}
                          onChange={(e)=>setLectureField(mi, li, "title", e.target.value)}
                        />
                        <input
                          className="input"
                          placeholder="Short description"
                          value={l.description}
                          onChange={(e)=>setLectureField(mi, li, "description", e.target.value)}
                        />
                      </div>
                      <div className="right">
                        <input
                          type="file"
                          accept="video/*"
                          onChange={(e)=>setLectureField(mi, li, "file", e.target.files?.[0] || null)}
                        />
                      </div>
                    </div>
                  ))}
                  {m.lectures.length === 0 && <div className="muted">No lectures yet.</div>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <button className="btn btn-primary" style={{ marginTop: 16 }} disabled={submitting} onClick={submit}>
          {submitting ? "Creating…" : "Create Course"}
        </button>
      </div>
    </div>
  );
}
