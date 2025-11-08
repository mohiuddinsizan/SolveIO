// src/components/Marketplace.jsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import "../styles/jobs.css";
import "../styles/forms.css";

const Chip = ({ text, onRemove }) => (
  <span className="chip chip-sm">
    {text}
    {!!onRemove && (
      <button type="button" onClick={onRemove} aria-label={`remove ${text}`}>×</button>
    )}
  </span>
);

/* ----------------------- fuzzy helpers (no UI changes) ---------------------- */
function fuzzyScore(needleRaw, hayRaw) {
  const needle = String(needleRaw || "").toLowerCase().trim();
  const hay = String(hayRaw || "").toLowerCase();
  if (!needle) return 1;
  if (!hay) return 0;

  if (hay === needle) return 1;
  if (hay.includes(needle)) {
    const pos = hay.indexOf(needle);
    return 0.7 + Math.max(0, 0.25 - pos / Math.max(1, hay.length));
  }

  let i = 0, j = 0, hits = 0, streak = 0, bestStreak = 0, gaps = 0;
  while (i < needle.length && j < hay.length) {
    if (needle[i] === hay[j]) { hits++; i++; j++; streak++; if (streak > bestStreak) bestStreak = streak; }
    else { if (streak > 0) gaps++; j++; streak = 0; }
  }
  if (hits < Math.ceil(needle.length * 0.6)) return 0;

  const coverage = hits / needle.length;
  const streakBonus = bestStreak / needle.length;
  const gapPenalty = Math.min(0.5, gaps / (needle.length + 2));
  const lengthPenalty = Math.min(0.2, (hay.length - hits) / 400);

  let score = 0.35 * coverage + 0.35 * streakBonus + 0.2 * (1 - gapPenalty) + 0.1 * (1 - lengthPenalty);
  if (score < 0) score = 0;
  if (score > 1) score = 1;
  return score;
}

function combineScore({ title, desc, skills, tags }, q) {
  const sTitle  = fuzzyScore(q, title);
  const sDesc   = fuzzyScore(q, desc);
  const sSkills = Math.max(...(skills || []).map((s) => fuzzyScore(q, s)), (skills?.length ? 0 : 0));
  const sTags   = Math.max(...(tags || []).map((t) => fuzzyScore(q, t)), (tags?.length ? 0 : 0));
  return 0.46 * sTitle + 0.24 * sSkills + 0.18 * sTags + 0.12 * sDesc;
}

/* -------------------------------------------------------------------------- */

export default function Marketplace() {
  // server data
  const [jobs, setJobs] = useState([]);
  const [meta, setMeta] = useState({ tags: [], skills: [] });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // classic filters
  const [q, setQ] = useState("");
  const [minBudget, setMinBudget] = useState("");
  const [minEmployerRating, setMinEmployerRating] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState([]);
  const [tagLogic, setTagLogic] = useState("OR"); // OR | AND

  // AI search
  const [showAi, setShowAi] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiErr, setAiErr] = useState("");
  const [aiMatches, setAiMatches] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const [{ data: metaData }, { data: jobsData }] = await Promise.all([
          api.get("/meta"),
          api.get("/jobs"),
        ]);
        setMeta(metaData || { tags: [], skills: [] });
        setJobs(jobsData || []);
      } catch (e) {
        setErr(e?.response?.data?.error || "Failed to load jobs");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const refreshFromServer = async () => {
    setLoading(true);
    setErr("");
    try {
      const params = {};
      if (q) params.q = q;
      if (tags.length) params.tags = tags; // axios serializes as repeated params
      if (minBudget) params.minBudget = parseFloat(minBudget);
      if (minEmployerRating) params.minEmployerRating = parseFloat(minEmployerRating);
      params.tagLogic = tagLogic;
      const { data } = await api.get("/jobs", { params });
      setJobs(data || []);
      // keep AI matches intact; user can still Clear AI explicitly
    } catch (e) {
      setErr(e?.response?.data?.error || "Failed to filter");
    } finally {
      setLoading(false);
    }
  };

  const commitTags = (raw) => {
    const parts = String(raw)
      .split(/[,\n]/g)
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);
    if (!parts.length) return;
    setTags(prev => {
      const set = new Set(prev);
      parts.forEach(p => set.add(p));
      return Array.from(set);
    });
    setTagInput("");
  };

  const addTag = () => commitTags(tagInput);
  const removeTag = (i) => setTags(tags.filter((_, idx) => idx !== i));

  const runAiSearch = async () => {
    setAiErr("");
    setAiLoading(true);
    try {
      const { data } = await api.post("/ai/find-jobs", {
        prompt: aiPrompt,
        q,
        tags,
        tagLogic,
        minBudget: Number(minBudget) || 0,
        minEmployerRating: Number(minEmployerRating) || 0,
        limit: 60,
      });
      const matches = Array.isArray(data?.matches) ? data.matches : [];
      setAiMatches(matches);
      setShowAi(false);
      setAiPrompt("");
    } catch (e) {
      setAiErr(e?.response?.data?.error || "Failed to run AI search");
    } finally {
      setAiLoading(false);
    }
  };
  const clearAi = () => setAiMatches(null);

  // ---------------------- instant, dynamic client-side filter -----------------
  const filtered = useMemo(() => {
    const source = aiMatches
      ? aiMatches.map(m => (m?.job ? m.job : m))
      : jobs;

    const query = String(q || "").toLowerCase().trim();
    const minB = Number(minBudget) || 0;
    const minR = Number(minEmployerRating) || 0;
    const selectedTags = (tags || []).map((t) => String(t).toLowerCase());

    const THRESHOLD = query ? 0.28 : 0;

    const matchesTagLogic = (jtags, selected) => {
      if (!selected.length) return true;
      const set = new Set((jtags || []).map(x => String(x).toLowerCase()));
      if (tagLogic === "AND") return selected.every(t => set.has(t));
      return selected.some(t => set.has(t)); // OR
    };

    const scored = source
      .map((j) => {
        if (minB && Number(j.budget || 0) < minB) return null;
        if (minR) {
          const er = Number(j?.employerRatingAvg || j?.employer?.ratingAvg || 0);
          if (er < minR) return null;
        }

        // pass if matches either tags OR requiredSkills (supports AND/OR)
        const tagPass =
          matchesTagLogic(j.tags, selectedTags) ||
          matchesTagLogic(j.requiredSkills, selectedTags);
        if (!tagPass) return null;

        let s = 1;
        if (query) {
          s = combineScore(
            { title: j.title, desc: j.description, skills: j.requiredSkills || [], tags: j.tags || [] },
            query
          );
          if (s < THRESHOLD) return null;
        }
        return { job: j, s };
      })
      .filter(Boolean);

    scored.sort((a, b) => {
      if (b.s !== a.s) return b.s - a.s;
      const ad = new Date(a.job.createdAt || 0).getTime();
      const bd = new Date(b.job.createdAt || 0).getTime();
      return bd - ad;
    });

    return scored.map((x) => x.job);
  }, [aiMatches, jobs, q, minBudget, minEmployerRating, tags, tagLogic]);
  // ---------------------------------------------------------------------------

  return (
    <div className="container">
      {/* Title row with Post Job button */}
      <div
        className="section-title"
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}
      >
        <h2 className="h2">Find Work</h2>
        <Link to="/jobs/new" className="btn btn-primary">
          Post Job
        </Link>
      </div>

      {/* ===== Toolbar ===== */}
      <div className="toolbar pro-toolbar pro-toolbar--wrap">
        <div className="toolbar-left">
          {/* Search box */}
          <div className="search-box">
            <input
              className="input"
              placeholder="Search title, description, skill…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="search"
              spellCheck={false}
            />
            {q && <button className="icon-btn" onClick={() => setQ("")} title="Clear search">✕</button>}
          </div>

          {/* Tag chipbox (multi-tag, dynamic) */}
          <div className="filter-chipbox">
            <div className="chip-input-row">
              <input
                className="input input-chip"
                placeholder="Add tags (Enter or comma)"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); addTag(); }
                  if (e.key === "," && tagInput.trim()) { e.preventDefault(); commitTags(tagInput); }
                }}
                list="tags-suggest"
                aria-label="tag filter"
                spellCheck={false}
              />
              <select
                className="input tag-logic"
                value={tagLogic}
                onChange={(e) => setTagLogic(e.target.value)}
                title="Tag logic"
                aria-label="Tag logic (AND/OR)"
              >
                <option value="OR">OR</option>
                <option value="AND">AND</option>
              </select>
              <button className="btn btn-outline" type="button" onClick={addTag}>Add</button>
              {tags.length > 0 && (
                <button className="btn btn-ghost" onClick={() => setTags([])}>Clear</button>
              )}
            </div>

            <datalist id="tags-suggest">
              {(meta.tags || []).map((t) => <option key={t} value={t} />)}
            </datalist>

            <div className="chip-row">
              {tags.map((t, i) => <Chip key={`${t}-${i}`} text={t} onRemove={() => removeTag(i)} />)}
            </div>
          </div>

          {/* Budget & rating */}
          <div className="min-budget">
            <label className="min-label">Min budget</label>
            <input
              className="input"
              type="number"
              min="0"
              placeholder="0"
              value={minBudget}
              onChange={(e) => setMinBudget(e.target.value)}
            />
          </div>

          <div className="min-budget">
            <label className="min-label">Min employer rating</label>
            <input
              className="input"
              type="number"
              min="0"
              max="5"
              step="0.1"
              placeholder="0-5"
              value={minEmployerRating}
              onChange={(e) => setMinEmployerRating(e.target.value)}
            />
          </div>
        </div>

        <div className="toolbar-right">
          {aiMatches && <span className="badge badge-info" title="AI filter active">AI Results</span>}
          <button className="btn btn-outline" onClick={clearAi} disabled={!aiMatches}>Clear AI</button>
          <button className="btn btn-primary" onClick={() => setShowAi(true)}>Search with AI</button>
          <button className="btn btn-outline" onClick={refreshFromServer} disabled={loading}>
            {loading ? "Loading…" : "Filter (server)"}
          </button>
        </div>
      </div>

      {err && <div className="error">{err}</div>}

      {/* Results */}
      <div className="job-list">
        {filtered.map((j) => (
          <Link key={j._id} to={`/jobs/${j._id}`} className="job-card">
            <div className="job-title">{j.title}</div>
            <div className="job-desc">
              {(j.description || "").slice(0, 160)}
              {String(j.description || "").length > 160 ? "…" : ""}
            </div>

            <div className="job-meta">
              <span className="badge">Budget: ${j.budget}</span>

              {/* NEW: Employer name + rating */}
              <span className="job-tag ghost" title="Posted by">
                by {j.employer?.name || j.employerName || "Employer"}
              </span>
              {(j.employer?.ratingAvg ?? j.employerRatingAvg) != null && (
                <span className="job-tag" title="Employer rating">
                  ⭐ {(j.employer?.ratingAvg ?? j.employerRatingAvg)?.toFixed(1)}
                  {typeof (j.employer?.ratingCount ?? j.employerRatingCount) === "number" &&
                    ` (${j.employer?.ratingCount ?? j.employerRatingCount})`}
                </span>
              )}

              {(j.tags || []).slice(0, 6).map((t) => (
                <span key={t} className="job-tag">{t}</span>
              ))}
              {(j.requiredSkills || []).slice(0, 6).map((s) => (
                <span key={s} className="job-tag ghost">{s}</span>
              ))}
            </div>
          </Link>
        ))}
        {!loading && filtered.length === 0 && (
          <div className="muted" style={{ marginTop: 12 }}>
            {aiMatches ? "No AI matches with current filters." : "No jobs match your filters."}
          </div>
        )}
      </div>

      {/* AI Modal */}
      {showAi && (
        <div className="modal-overlay">
          <div className="modal-content modal-content--wide">
            <h3>Search with AI</h3>
            <p className="muted" style={{ marginTop: 6 }}>
              Describe what you're looking for (stack, domain, budget vibe). We’ll infer tags and show only matching jobs.
            </p>
            <textarea
              className="input textarea-large"
              rows={6}
              placeholder={`e.g. "React/Next.js ecommerce, payment gateway (Stripe/SSLCommerz), SEO friendly, $300+ gigs"`}
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
            />
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 12 }}>
              <button className="btn btn-outline" onClick={() => setShowAi(false)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={runAiSearch}
                disabled={aiLoading || !aiPrompt.trim()}
              >
                {aiLoading ? "Searching…" : "Find Matches"}
              </button>
            </div>
            {aiErr && <div className="error mt-2">{aiErr}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
