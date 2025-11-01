import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import "../styles/jobs.css";

export default function Marketplace(){
  const [q, setQ] = useState("");
  const [tags, setTags] = useState("");        // comma separated
  const [minBudget, setMinBudget] = useState("");
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const params = {};
    if (q) params.q = q;
    if (tags) params.tags = tags;
    if (minBudget) params.minBudget = minBudget;
    const { data } = await api.get("/jobs", { params });
    setJobs(data);
    setLoading(false);
  };

  useEffect(() => { load(); /* initial */ }, []);

  return (
    <div className="container">
      <div className="section-title">
        <h2 className="h2">Job Marketplace</h2>
        <Link to="/jobs/new" className="btn btn-primary">Post Job</Link>
      </div>

      <div className="toolbar">
        <input className="input" placeholder="Search text…" value={q} onChange={e=>setQ(e.target.value)} />
        <input className="input tags" placeholder="Tags (comma separated)" value={tags} onChange={e=>setTags(e.target.value)} />
        <input className="input" placeholder="Min budget" value={minBudget} onChange={e=>setMinBudget(e.target.value)} />
        <button className="btn btn-outline" onClick={load} disabled={loading}>{loading ? "Loading…" : "Filter"}</button>
      </div>

      <div className="job-list">
        {jobs.map(j => (
          <Link key={j._id} to={`/jobs/${j._id}`} className="job-card">
            <div className="job-title">{j.title}</div>
            <div className="job-desc">{j.description?.slice(0, 140)}</div>
            <div className="job-meta">
              <span className="badge">Budget: ${j.budget}</span>
              {j.tags?.slice(0,5).map(t => <span key={t} className="job-tag">{t}</span>)}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
