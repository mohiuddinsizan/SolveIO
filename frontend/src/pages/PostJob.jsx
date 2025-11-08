// frontend/src/pages/PostJob.jsx
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import "../styles/forms.css";

/* ------------------------- ChipInput ------------------------- */
const ChipInput = ({ values, onChange, placeholder, suggestions = [] }) => {
  const [inputValue, setInputValue] = useState("");
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (inputValue.trim()) {
        const newValue = inputValue.trim().toLowerCase();
        if (!values.includes(newValue)) onChange([...values, newValue]);
        setInputValue("");
        setFilteredSuggestions([]);
      }
    }
  };

  const handleChange = (e) => {
    const val = e.target.value;
    setInputValue(val);
    if (val) {
      const filtered = (suggestions || []).filter(
        (s) =>
          s.toLowerCase().startsWith(val.toLowerCase()) &&
          !values.includes(s.toLowerCase())
      );
      setFilteredSuggestions(filtered);
    } else setFilteredSuggestions([]);
  };

  const addSuggestion = (sug) => {
    const newValue = sug.toLowerCase();
    if (!values.includes(newValue)) onChange([...values, newValue]);
    setInputValue("");
    setFilteredSuggestions([]);
  };

  const removeChip = (index) => onChange(values.filter((_, i) => i !== index));

  return (
    <div className="chip-input">
      <div className="chips">
        {values.map((val, i) => (
          <span key={i} className="chip">
            {val}
            <button type="button" onClick={() => removeChip(i)}>×</button>
          </span>
        ))}
      </div>
      <input
        type="text"
        value={inputValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
      />
      {filteredSuggestions.length > 0 && (
        <ul className="suggestions">
          {filteredSuggestions.map((sug, i) => (
            <li key={i} onClick={() => addSuggestion(sug)}>{sug}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

/* ---------------------- JSON patch extractor ---------------------- */
function extractJsonPatchFromText(text) {
  if (!text) return null;
  const fence = text.match(/```json\s*([\s\S]*?)\s*```/i);
  const raw = fence ? fence[1] : (text.match(/\{[\s\S]*\}$/) || [])[0];
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const allowed = [
      "title",
      "description",
      "requiredSkills",
      "tags",
      "budget",
      "budgetType",
      "experienceLevel",
      "deadline",
    ];
    const clean = {};
    for (const k of allowed) if (k in parsed) clean[k] = parsed[k];
    return Object.keys(clean).length ? clean : null;
  } catch {
    return null;
  }
}

/* ------------------ Client-side validation/coercion ------------------ */
function validateAndCoerceForPost(job) {
  const errors = [];

  const title = String(job.title || "").trim();
  const description = String(job.description || "").trim();
  if (!title) errors.push("title");
  if (!description) errors.push("description");

  const requiredSkills = Array.isArray(job.requiredSkills)
    ? job.requiredSkills.filter(Boolean)
    : [];
  const tags = Array.isArray(job.tags) ? job.tags.filter(Boolean) : [];
  if (requiredSkills.length === 0) errors.push("requiredSkills");
  if (tags.length === 0) errors.push("tags");

  let budget = Number(job.budget);
  if (!Number.isFinite(budget) || budget <= 0) errors.push("budget");

  // NOTE: backend doesn't store budgetType/experience/deadline; we keep them client-side
  // but we don't block post if they're missing

  if (errors.length) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      title,
      description,
      requiredSkills,
      tags,
      budget,
    },
  };
}

/* -------- choose transport: JSON if no files, FormData if files -------- */
async function createJobSmart(payload, attachments) {
  if (!attachments || attachments.length === 0) {
    return api.post("/jobs", payload); // JSON
  }
  const fd = new FormData();
  fd.append("title", payload.title);
  fd.append("description", payload.description);
  fd.append("requiredSkills", JSON.stringify(payload.requiredSkills));
  fd.append("tags", JSON.stringify(payload.tags));
  fd.append("budget", payload.budget);
  attachments.forEach((f) => fd.append("attachments", f));
  return api.post("/jobs", fd, { headers: { "Content-Type": "multipart/form-data" } });
}

/* --------------------------------- Page ---------------------------------- */
export default function PostJob() {
  const nav = useNavigate();

  // meta
  const [meta, setMeta] = useState({ skills: [], tags: [] });

  // job fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requiredSkills, setRequiredSkills] = useState([]);
  const [tags, setTags] = useState([]);
  const [budget, setBudget] = useState("");
  const [budgetType, setBudgetType] = useState("fixed");
  const [experienceLevel, setExperienceLevel] = useState("intermediate");
  const [deadline, setDeadline] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [err, setErr] = useState("");

  // AI modal
  const [showAi, setShowAi] = useState(false);
  const [tab, setTab] = useState("generate"); // "generate" | "chat"

  // Quick generate
  const [genPrompt, setGenPrompt] = useState("");
  const [aiGenerated, setAiGenerated] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiErr, setAiErr] = useState("");

  // Chat
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text:
        "Tell me what you want to post. I can suggest titles, descriptions, skills, tags, and budgets.\nIf I include a JSON block, you can apply it to the form with one click.",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [lastPatch, setLastPatch] = useState(null);
  const chatEndRef = useRef(null);

  // load meta
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/meta");
        setMeta(data || { skills: [], tags: [] });
      } catch {
        setMeta({ skills: [], tags: [] });
      }
    })();
  }, []);

  // autoscroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, showAi]);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    setAttachments(files.slice(0, 5));
  };

  /* -------------------- AI: Quick Generate -------------------- */
  const generateJob = async () => {
    setAiErr("");
    setAiLoading(true);
    setAiGenerated(null);
    try {
      const { data } = await api.post("/ai/generate", { prompt: genPrompt });
      const job = data?.job;
      if (
        !job ||
        typeof job.title !== "string" ||
        typeof job.description !== "string" ||
        !Array.isArray(job.requiredSkills) ||
        !Array.isArray(job.tags)
      ) {
        throw new Error("AI did not return a complete job.");
      }
      setAiGenerated({
        ...job,
        requiredSkills: job.requiredSkills.map((s) => String(s)),
        tags: job.tags.map((s) => String(s)),
      });
    } catch (e) {
      setAiErr(e?.response?.data?.error || e.message || "Generate failed");
    } finally {
      setAiLoading(false);
    }
  };

  const postDirectly = async () => {
    try {
      if (!aiGenerated) throw new Error("Nothing to post.");
      const check = validateAndCoerceForPost(aiGenerated);
      if (!check.ok) throw new Error("Missing/invalid fields: " + check.errors.join(", "));
      const j = check.data;

      const { data } = await createJobSmart(
        {
          title: j.title,
          description: j.description,
          requiredSkills: j.requiredSkills,
          tags: j.tags,
          budget: j.budget,
        },
        [] // no files in AI path
      );

      setShowAi(false);
      setAiGenerated(null);
      nav(`/jobs/${data._id}`);
    } catch (e) {
      setAiErr(e?.response?.data?.error || e.message || "Post failed");
    }
  };

  const editFromAi = () => {
    if (!aiGenerated) return;
    setTitle(aiGenerated.title || "");
    setDescription(aiGenerated.description || "");
    setRequiredSkills((aiGenerated.requiredSkills || []).map((s) => String(s).toLowerCase()));
    setTags((aiGenerated.tags || []).map((s) => String(s).toLowerCase()));
    setBudget(String(aiGenerated.budget ?? ""));
    setBudgetType(aiGenerated.budgetType || "fixed");
    setExperienceLevel(aiGenerated.experienceLevel || "intermediate");
    setDeadline(aiGenerated.deadline || "");
    setShowAi(false);
    setAiGenerated(null);
  };

  /* -------------------- AI: Chat -------------------- */
  const sendChat = async () => {
    const userText = chatInput.trim();
    if (!userText || chatBusy) return;
    setChatInput("");
    setMessages((m) => [...m, { role: "user", text: userText }]);
    setChatBusy(true);
    setLastPatch(null);

    try {
      const context = { title, description, requiredSkills, tags, budget, budgetType, experienceLevel, deadline };
      const { data } = await api.post("/ai/chat", { message: userText, context });
      const reply = data?.reply || "Sorry, no reply.";
      const patch = extractJsonPatchFromText(reply);
      setLastPatch(patch || null);
      setMessages((m) => [...m, { role: "assistant", text: reply }]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", text: "Sorry, I couldn’t reach the AI service. Try again." },
      ]);
    } finally {
      setChatBusy(false);
    }
  };

  const applyPatch = () => {
    if (!lastPatch) return;
    if (typeof lastPatch.title === "string") setTitle(lastPatch.title);
    if (typeof lastPatch.description === "string") setDescription(lastPatch.description);
    if (Array.isArray(lastPatch.requiredSkills))
      setRequiredSkills(lastPatch.requiredSkills.map((s) => String(s).toLowerCase()));
    if (Array.isArray(lastPatch.tags))
      setTags(lastPatch.tags.map((s) => String(s).toLowerCase()));
    if (Number.isFinite(lastPatch.budget)) setBudget(String(lastPatch.budget));
    if (["fixed", "hourly"].includes(String(lastPatch.budgetType).toLowerCase()))
      setBudgetType(String(lastPatch.budgetType).toLowerCase());
    if (["entry", "intermediate", "expert"].includes(String(lastPatch.experienceLevel).toLowerCase()))
      setExperienceLevel(String(lastPatch.experienceLevel).toLowerCase());
    if (typeof lastPatch.deadline === "string") setDeadline(lastPatch.deadline);
    setLastPatch(null);
  };

  /* -------------------- Submit Form -------------------- */
  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    try {
      const check = validateAndCoerceForPost({
        title, description, requiredSkills, tags, budget, budgetType, experienceLevel, deadline
      });
      if (!check.ok) throw new Error("Missing/invalid fields: " + check.errors.join(", "));
      const j = check.data;

      const { data } = await createJobSmart(
        {
          title: j.title,
          description: j.description,
          requiredSkills: j.requiredSkills,
          tags: j.tags,
          budget: j.budget,
        },
        attachments
      );

      nav(`/jobs/${data._id}`);
    } catch (e) {
      setErr(e?.response?.data?.error || e.message || "Failed to post job");
    }
  };

  const missingList = (txt) => {
    if (!txt) return null;
    if (!txt.startsWith("Missing/invalid fields:")) return null;
    const fields = txt.split(":")[1]?.trim() || "";
    return fields.split(",").map((s) => s.trim()).filter(Boolean);
  };

  const formMissing = missingList(err);
  const aiMissing = missingList(aiErr);

  return (
    <div className="auth-wrapper">
      <div className="panel auth-card" style={{ maxWidth: 820 }}>
        <h2 className="h2 form-title">Post a Job</h2>
        <div style={{ display: "flex", gap: 8, justifyContent: "space-between", marginBottom: 12 }}>
          <button className="btn btn-outline" onClick={() => { setShowAi(true); setTab("generate"); }}>
            Get Help from AI
          </button>
          <a className="btn btn-outline" href="/jobs">Cancel</a>
        </div>

        {err && (
          <div className="error">
            {err}
            {formMissing && (
              <div className="muted" style={{ marginTop: 6 }}>
                Fix: {formMissing.join(", ")}
              </div>
            )}
          </div>
        )}

        <form className="form" onSubmit={onSubmit}>
          <div className="form-group">
            <label className="form-label">Job Title</label>
            <input
              className={`input${formMissing?.includes("title") ? " input-invalid" : ""}`}
              placeholder="Enter a descriptive title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Job Description</label>
            <textarea
              className={`input textarea-large${formMissing?.includes("description") ? " input-invalid" : ""}`}
              rows={8}
              placeholder="Provide detailed requirements, scope, and deliverables"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Required Skills</label>
            <ChipInput
              values={requiredSkills}
              onChange={setRequiredSkills}
              placeholder="Type a skill and press Enter"
              suggestions={meta.skills}
            />
            {formMissing?.includes("requiredSkills") && (
              <div className="error">Add at least one skill.</div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Categories/Tags</label>
            <ChipInput
              values={tags}
              onChange={setTags}
              placeholder="Type a tag and press Enter"
              suggestions={meta.tags}
            />
            {formMissing?.includes("tags") && (
              <div className="error">Add at least one tag.</div>
            )}
          </div>

          <div className="form-group row">
            <div className="col">
              <label className="form-label">Budget Type</label>
              <select
                className="select"
                value={budgetType}
                onChange={(e) => setBudgetType(e.target.value)}
              >
                <option value="fixed">Fixed Price</option>
                <option value="hourly">Hourly Rate</option>
              </select>
            </div>
            <div className="col">
              <label className="form-label">Budget/Rate ($)</label>
              <input
                className={`input${formMissing?.includes("budget") ? " input-invalid" : ""}`}
                type="number"
                min="5"
                placeholder={budgetType === "hourly" ? "e.g., 25/hr" : "e.g., 500"}
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group row">
            <div className="col">
              <label className="form-label">Experience Level</label>
              <select
                className="select"
                value={experienceLevel}
                onChange={(e) => setExperienceLevel(e.target.value)}
              >
                <option value="entry">Entry Level</option>
                <option value="intermediate">Intermediate</option>
                <option value="expert">Expert</option>
              </select>
            </div>
            <div className="col">
              <label className="form-label">Deadline</label>
              <input
                className="input"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Attachments (optional)</label>
            <input
              className="input file-input"
              type="file"
              multiple
              onChange={handleFileChange}
              accept=".pdf,.doc,.docx,.jpg,.png"
            />
            <div className="muted">Upload requirements docs, mockups, etc. (max 5 files)</div>
          </div>

          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <button className="btn btn-primary" type="submit">Post Job</button>
          </div>
        </form>
      </div>

      {/* AI Modal */}
      {showAi && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 900 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <button
                className={`btn ${tab === "generate" ? "btn-primary" : "btn-outline"}`}
                onClick={() => setTab("generate")}
              >
                ⚡ Quick Generate
              </button>
              <button
                className={`btn ${tab === "chat" ? "btn-primary" : "btn-outline"}`}
                onClick={() => setTab("chat")}
              >
                💬 Chat
              </button>
              <div style={{ flex: 1 }} />
              <button className="btn btn-outline" onClick={() => setShowAi(false)}>Close</button>
            </div>

            {tab === "generate" && (
              <>
                <div className="panel" style={{ background: "#1b1b1b" }}>
                  <label className="form-label">Describe the job</label>
                  <textarea
                    className="input textarea-large"
                    rows={5}
                    placeholder="Example: Need a 3–5 page responsive website with SEO and clean UI."
                    value={genPrompt}
                    onChange={(e) => setGenPrompt(e.target.value)}
                  />
                  <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
                    <button
                      className="btn btn-primary"
                      onClick={generateJob}
                      disabled={aiLoading || !genPrompt.trim()}
                    >
                      {aiLoading ? "Generating…" : "Generate Job Post"}
                    </button>
                    {aiErr && (
                      <div className="error">
                        {aiErr}
                        {aiMissing && (
                          <div className="muted" style={{ marginTop: 6 }}>
                            Missing: {aiMissing.join(", ")}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {aiGenerated && (
                  <div className="panel ai-preview" style={{ marginTop: 12 }}>
                    <h4 style={{ marginBottom: 8 }}>Generated Job Post</h4>
                    <p><b>Title:</b> {aiGenerated.title}</p>
                    <p><b>Description:</b> {aiGenerated.description}</p>
                    <p><b>Skills:</b> {(aiGenerated.requiredSkills || []).join(", ")}</p>
                    <p><b>Tags:</b> {(aiGenerated.tags || []).join(", ")}</p>
                    <p><b>Budget:</b> ${aiGenerated.budget} ({aiGenerated.budgetType})</p>
                    <p><b>Experience:</b> {aiGenerated.experienceLevel}</p>
                    <p><b>Deadline:</b> {aiGenerated.deadline || "None"}</p>

                    <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 12 }}>
                      <button className="btn btn-primary" onClick={postDirectly}>Post Directly</button>
                      <button className="btn btn-outline" onClick={editFromAi}>Edit in Form</button>
                      <button className="btn btn-outline" onClick={() => setAiGenerated(null)}>Discard</button>
                    </div>
                  </div>
                )}
              </>
            )}

            {tab === "chat" && (
              <>
                <div
                  className="ai-chat-box"
                  style={{
                    border: "1px solid #2f2f2f",
                    borderRadius: 12,
                    padding: 12,
                    height: 360,
                    overflow: "auto",
                    background: "#141414",
                  }}
                >
                  {messages.map((m, idx) => (
                    <div
                      key={idx}
                      style={{
                        margin: "8px 0",
                        padding: "8px 12px",
                        borderRadius: 8,
                        background: m.role === "user" ? "#223" : "#1f1f1f",
                        border: "1px solid #2e2e2e",
                      }}
                    >
                      <div style={{ fontWeight: 700, marginBottom: 2, color: "#38d39f" }}>
                        {m.role === "user" ? "You" : "Assistant"}
                      </div>
                      <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <input
                    className="input"
                    placeholder="Tell the assistant what you need…"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") sendChat(); }}
                  />
                  <button className="btn btn-primary" onClick={sendChat} disabled={chatBusy || !chatInput.trim()}>
                    {chatBusy ? "Sending…" : "Send"}
                  </button>
                </div>

                {lastPatch && (
                  <div className="panel" style={{ marginTop: 12, background: "#0c1820", border: "1px solid #133247" }}>
                    <div style={{ marginBottom: 6, fontWeight: 700 }}>
                      Assistant suggested updates. Apply to form?
                    </div>
                    <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
{JSON.stringify(lastPatch, null, 2)}
                    </pre>
                    <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                      <button className="btn btn-primary" onClick={applyPatch}>Apply to Form</button>
                      <button className="btn btn-outline" onClick={() => setLastPatch(null)}>Dismiss</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
