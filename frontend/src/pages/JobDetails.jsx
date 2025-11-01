import { useEffect, useState, useMemo } from "react";
import { useParams, useLocation } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../store/auth";
import "../styles/jobs.css";
import "../styles/stats.css";
import "../styles/orders.css";

// helpers
const idOf = (v) => (v && typeof v === "object" ? v._id || v.id || null : v || null);
const sid = (v) => (v == null ? null : String(v));
const initials = (name = "") => {
  const parts = String(name).trim().split(/\s+/).slice(0, 2);
  return parts.map(p => p[0]?.toUpperCase()).join("") || "U";
};

export default function JobDetails() {
  const { id } = useParams();
  const location = useLocation();
  const { user } = useAuth();

  const [job, setJob] = useState(null);
  const [apps, setApps] = useState([]);
  const [escrow, setEscrow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Apply (worker)
  const [proposal, setProposal] = useState("");
  const [askPrice, setAskPrice] = useState("");
  const [applyMsg, setApplyMsg] = useState("");

  // Submit (worker)
  const [note, setNote] = useState("");
  const [url, setUrl] = useState("");

  // Ratings
  const [rateScore, setRateScore] = useState(5);
  const [rateComment, setRateComment] = useState("");

  // Employer approval inputs
  const [empScore, setEmpScore] = useState(5);
  const [empComment, setEmpComment] = useState("");
  const [tip, setTip] = useState("");

  // Chat
  const [messages, setMessages] = useState([]);
  const [chatText, setChatText] = useState("");

  // normalize identities
  const myId = useMemo(() => sid(user?.id || user?._id), [user]);
  const jobEmployerId = useMemo(() => sid(idOf(job?.employerId)), [job]);
  const jobWorkerId = useMemo(() => sid(idOf(job?.assignedTo)), [job]);

  const isEmployerOwner = useMemo(
    () => !!myId && !!jobEmployerId && myId === jobEmployerId && user?.role === "employer",
    [myId, jobEmployerId, user?.role]
  );
  const isAssignedWorker = useMemo(
    () => !!myId && !!jobWorkerId && myId === jobWorkerId && user?.role === "worker",
    [myId, jobWorkerId, user?.role]
  );
  const canSeeChat = useMemo(() => {
    if (!job) return false;
    if (!isEmployerOwner && !isAssignedWorker) return false;
    return job.status !== "open"; // assigned / awaiting-approval / completed
  }, [job, isEmployerOwner, isAssignedWorker]);

  // try to derive display names (if backend didn’t populate, we still show role labels)
  const employerName = job?.employerName || job?.employer?.name || "Employer";
  const workerName = job?.workerName || job?.freelancer?.name || "Freelancer";
  const meName = (isEmployerOwner ? employerName : isAssignedWorker ? workerName : user?.name) || "You";

  const labelForSender = (from) => {
    const f = sid(idOf(from));
    if (!f) return { who: "Unknown", role: "unknown", name: "Unknown", them: true };

    if (f === myId) {
      return { who: "You", role: user?.role || "me", name: meName, them: false };
    }
    if (f === jobEmployerId) {
      return { who: employerName, role: "employer", name: employerName, them: true };
    }
    if (f === jobWorkerId) {
      return { who: workerName, role: "freelancer", name: workerName, them: true };
    }
    // fallback
    return { who: "Participant", role: "participant", name: "Participant", them: true };
  };

  const loadChat = async () => {
    try {
      if (!canSeeChat) { setMessages([]); return; }
      const { data } = await api.get(`/jobs/${id}/messages`);
      setMessages(data);
    } catch { }
  };

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/jobs/${id}`);
      setJob(data);

      if (user?.role === "employer" && data.status === "open") {
        try { const res = await api.get(`/jobs/${id}/applicants`); setApps(res.data); } catch { }
      }
      try { const es = await api.get(`/jobs/${id}/escrow`); setEscrow(es.data); } catch { }

      setLoading(false);
    } catch (e) {
      setErr(e?.response?.data?.error || "Failed to load job");
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id, user?.id, user?._id, user?.role]);
  useEffect(() => { loadChat(); }, [canSeeChat, id]);

  useEffect(() => {
    if (location.hash === "#chat" && canSeeChat) {
      setTimeout(() => {
        const el = document.getElementById("chat");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    }
  }, [location.hash, canSeeChat]);

  // actions
  const submitApp = async (e) => {
    e.preventDefault();
    setApplyMsg("");
    try {
      await api.post(`/jobs/${id}/apply`, { proposal, askPrice: Number(askPrice) });
      setApplyMsg("Applied successfully!");
      setProposal(""); setAskPrice("");
    } catch (e) {
      setApplyMsg(e?.response?.data?.error || "Failed to apply");
    }
  };

  const assign = async (applicationId) => {
    try {
      await api.post(`/jobs/${id}/assign`, { applicationId });
      await load();
      alert("Assigned. Please fund escrow to proceed.");
    } catch (e) {
      alert(e?.response?.data?.error || "Failed to assign");
    }
  };

  const fund = async () => {
    try {
      await api.post(`/jobs/${id}/escrow/fund`);
      await load();
      alert("Escrow funded. Company is now holding the funds.");
    } catch (e) {
      alert(e?.response?.data?.error || "Failed to fund");
    }
  };

  const submitWork = async () => {
    try {
      await api.post(`/jobs/${id}/submit`, { note, url });
      await load();
      alert("Submitted for approval. Employer must confirm to release payment.");
    } catch (e) {
      alert(e?.response?.data?.error || "Failed to submit");
    }
  };

  const approveWithFeedback = async () => {
    const ok = window.confirm(
      "Confirm completion? 95% will be released to the freelancer immediately; 5% kept by company."
    );
    if (!ok) return;
    try {
      await api.post(`/jobs/${id}/approve`);
      if (empScore) await api.post(`/jobs/${id}/rate`, { score: Number(empScore), comment: empComment });
      if (Number(tip) > 0) await api.post(`/jobs/${id}/tip`, { amount: Number(tip) });
      await load();
      alert("Approved. Escrow released and feedback recorded.");
    } catch (e) {
      alert(e?.response?.data?.error || "Failed to approve");
    }
  };

  const rate = async () => {
    try {
      await api.post(`/jobs/${id}/rate`, { score: Number(rateScore), comment: rateComment });
      await load();
      alert("Rating saved.");
    } catch (e) {
      alert(e?.response?.data?.error || "Failed to rate");
    }
  };

  const sendChat = async () => {
    if (!chatText.trim()) return;
    try {
      await api.post(`/jobs/${id}/messages`, { text: chatText });
      setChatText("");
      await loadChat();
    } catch (e) {
      alert(e?.response?.data?.error || "Failed to send");
    }
  };

  if (loading) return <div className="container">Loading…</div>;
  if (!job) return <div className="container">Not found</div>;

  const escrowStatus = job.escrowStatus || escrow?.status || "unfunded";

  return (
    <div className="container detail-wrap">
      <div className="detail-header">
        <div className="detail-title">{job.title}</div>
        <span className="badge">Budget: ${job.budget}</span>
      </div>

      <div className="detail-body">
        <div className="card">
          <b>Description</b>
          <p className="mt-2">{job.description}</p>

          <div className="mt-3">
            <b>Required skills</b>
            <div className="job-meta mt-1">
              {job.requiredSkills?.map(s => <span key={s} className="job-tag">{s}</span>)}
            </div>
          </div>

          <div className="mt-3">
            <b>Tags</b>
            <div className="job-meta mt-1">
              {job.tags?.map(t => <span key={t} className="job-tag">{t}</span>)}
            </div>
          </div>

          <div className="mt-3">
            <b>Status:</b> <span className="badge">{job.status}</span>
          </div>

          <div className="mt-3 escrow-box">
            <div><b>Escrow:</b> <span className="escrow-status">{escrowStatus}</span></div>

            {isEmployerOwner && job.status !== "completed" && (
              <>
                {job.status === "assigned" && (
                  <div className="mt-1" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      className="btn btn-primary"
                      onClick={fund}
                      disabled={escrowStatus === "funded"}
                      title={escrowStatus === "funded" ? "Already funded" : "Fund escrow to start"}
                    >
                      {escrowStatus === "funded" ? "Escrow Funded" : "Fund Escrow"}
                    </button>
                  </div>
                )}
                {job.status === "awaiting-approval" && (
                  <div className="panel mt-3">
                    <b>Confirm Completion & Feedback</b>
                    <div className="app-form mt-2">
                      <div className="rowflex">
                        <label className="small">Your rating (1–5)</label>
                        <select className="select" value={empScore} onChange={e => setEmpScore(Number(e.target.value))}>
                          {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </div>
                      <textarea className="input" rows={3} placeholder="Short feedback for freelancer" value={empComment} onChange={e => setEmpComment(e.target.value)} />
                      <input className="input" type="number" min="0" placeholder="Tip amount (optional)" value={tip} onChange={e => setTip(e.target.value)} />
                      <button className="btn btn-primary" onClick={approveWithFeedback}>Confirm & Release (with Feedback)</button>
                    </div>
                  </div>
                )}
              </>
            )}

            {isAssignedWorker && job.status !== "completed" && (
              <div className="mt-1">
                <div className="muted">
                  {escrowStatus === "funded"
                    ? "Escrow funded. You can submit your work."
                    : "Waiting for employer to fund escrow. You can still prepare your submission."}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="sidebar">
          {user?.role === "worker" && job.status === "open" && (
            <div className="panel">
              <b>Apply to this job</b>
              <form className="app-form mt-2" onSubmit={submitApp}>
                <textarea className="input" rows={5} placeholder="Short proposal" value={proposal} onChange={e => setProposal(e.target.value)} />
                <input className="input" type="number" placeholder="Your price (USD)" value={askPrice} onChange={e => setAskPrice(e.target.value)} />
                <button className="btn btn-primary">Submit application</button>
                {applyMsg && <div className="mt-1 muted">{applyMsg}</div>}
              </form>
            </div>
          )}

          {isEmployerOwner && job.status === "open" && (
            <div className="panel mt-3">
              <div className="app-header">
                <b>Applicants</b><span className="badge">{apps.length}</span>
              </div>
              <div className="mt-2">
                {apps.length === 0 && <div className="muted">No applicants yet.</div>}
                {apps.map(a => (
                  <div className="app-item mt-1" key={a._id}>
                    <div className="app-header">
                      <div style={{ fontWeight: 700 }}>{a.freelancerId?.name}</div>
                      <span className="badge">${a.askPrice}</span>
                    </div>
                    <div className="app-row mt-1">
                      <span>Skills:</span>
                      <div className="job-meta">{a.freelancerId?.skills?.map(s => <span key={s} className="job-tag">{s}</span>)}</div>
                    </div>
                    <div className="mt-1" style={{ fontSize: 14 }}>{a.proposal}</div>
                    <div className="mt-2" style={{ display: "flex", gap: 8 }}>
                      <button className="btn btn-primary" onClick={() => assign(a._id)}>Assign (then fund)</button>
                    </div>
                  </div>
                ))}
              </div>
              {err && <div className="error mt-1">{err}</div>}
            </div>
          )}

          {isAssignedWorker && (job.status === "assigned" || job.status === "awaiting-approval") && (
            <div className="panel mt-3">
              <b>Submit work</b>
              <div className="muted">Submission is enabled once escrow is funded.</div>
              <div className="app-form mt-2">
                <textarea className="input" rows={4} placeholder="Submission note" value={note} onChange={e => setNote(e.target.value)} />
                <input className="input" placeholder="URL (demo / file link)" value={url} onChange={e => setUrl(e.target.value)} />
                <button
                  className="btn btn-primary"
                  disabled={escrowStatus !== "funded"}
                  title={escrowStatus !== "funded" ? "Escrow must be funded" : "Submit your work"}
                  onClick={submitWork}
                >
                  Mark as Completed
                </button>
              </div>
            </div>
          )}

          {/* ==== CHAT – now clearly shows who sent what ==== */}
{/* ==== CHAT ==== */}
{canSeeChat && (
  <div className="panel mt-3" id="chat">
    <b>Order Chat</b>
    <div className="chat mt-2">
      <div className="chat-box">
        {messages.map(m => {
          // Normalize IDs: handle strings or populated objects
          const myId =
            String(user?.id || user?._id || "");
          const fromId =
            String(
              (m?.from && (m.from._id || m.from.id || m.from)) ||
              (m?.sender && (m.sender._id || m.sender.id || m.sender)) ||
              (m?.senderId) ||
              ""
            );

        // If either side missing, default to "them" to be safe
          const mine = myId && fromId && myId === fromId;

          return (
            <div key={m._id || `${fromId}-${m.createdAt}`} className={`msg-row ${mine ? "me" : "them"}`}>
              <div className="msg-bubble">
                <div className="msg-text">{m.text}</div>
                <div className="msg-time">{new Date(m.createdAt).toLocaleString()}</div>
              </div>
            </div>
          );
        })}
        {messages.length === 0 && <div className="muted">No messages yet.</div>}
      </div>

      <div className="chat-row">
        <input
          className="input"
          placeholder="Type a message…"
          value={chatText}
          onChange={e => setChatText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); }
          }}
        />
        <button className="btn btn-primary" onClick={sendChat}>Send</button>
      </div>
    </div>
  </div>
)}


          {user?.role === "worker" && job.status === "completed" && (
            <div className="panel mt-3">
              <b>Rate the Employer</b>
              <div className="app-form mt-2">
                <select className="select" value={rateScore} onChange={e => setRateScore(Number(e.target.value))}>
                  {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <textarea className="input" rows={3} placeholder="Comment" value={rateComment} onChange={e => setRateComment(e.target.value)} />
                <button className="btn btn-primary" onClick={rate}>Submit Rating</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
