import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import MultiSelect from "../components/MultiSelect";
import "../styles/forms.css";

export default function PostJob(){
  const nav = useNavigate();
  const [meta, setMeta] = useState({ skills: [], tags: [] });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requiredSkills, setRequiredSkills] = useState([]);
  const [tags, setTags] = useState([]);
  const [budget, setBudget] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    (async ()=>{
      const { data } = await api.get("/meta");
      setMeta(data);
    })();
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    try {
      const body = {
        title,
        description,
        requiredSkills,
        tags,
        budget: Number(budget)
      };
      const { data } = await api.post("/jobs", body);
      nav(`/jobs/${data._id}`);
    } catch (e) {
      setErr(e?.response?.data?.error || "Failed to post job");
    }
  };

  return (
    <div className="container">
      <div className="panel auth-card" style={{maxWidth: 760}}>
        <h2 className="h2 form-title">Post a Job</h2>
        {err && <div className="error">{err}</div>}
        <form className="form" onSubmit={onSubmit}>
          <input className="input" placeholder="Title" value={title} onChange={e=>setTitle(e.target.value)} />
          <textarea className="input" rows={5} placeholder="Description" value={description} onChange={e=>setDescription(e.target.value)} />

          <MultiSelect
            label="Required skills"
            options={meta.skills}
            values={requiredSkills}
            onChange={setRequiredSkills}
            placeholder="Select skills…"
          />

          <MultiSelect
            label="Tags"
            options={meta.tags}
            values={tags}
            onChange={setTags}
            placeholder="Select tags…"
          />

          <input className="input" type="number" placeholder="Budget in USD" value={budget} onChange={e=>setBudget(e.target.value)} />

          <div style={{display:"flex", gap:12}}>
            <button className="btn btn-primary" type="submit">Create Job</button>
            <a className="btn btn-outline" href="/jobs">Cancel</a>
          </div>
        </form>
      </div>
    </div>
  );
}
