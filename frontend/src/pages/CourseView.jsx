import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../lib/api";
import "../styles/courses.css";

const API_ORIGIN = (api?.defaults?.baseURL?.replace("/api/v1", "")) || "http://localhost:5000";
function resolveSrc(p) {
  if (!p) return null;
  if (/^https?:\/\//i.test(p)) return p;
  return `${API_ORIGIN}${p.startsWith("/") ? p : `/${p}`}`;
}

export default function CourseView() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [active, setActive] = useState({ m: 0, v: 0 });
  const [showBuy, setShowBuy] = useState(false);
  const [code, setCode] = useState("");
  const [buying, setBuying] = useState(false);

  const videoRef = useRef(null);
  const [runtimeDurationSec, setRuntimeDurationSec] = useState(null);

  async function load() {
    const res = await api.get(`/courses/${id}`);
    setData(res.data);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  useEffect(() => { setRuntimeDurationSec(null); }, [active.m, active.v]);

  if (!data) return (
    <div className="courses"><div className="container"><div className="muted">Loading…</div></div></div>
  );

  const { course, canView, purchased } = data;
  const current = course.modules?.[active.m]?.videos?.[active.v];

  const raw = current && !current.locked ? (current.hlsPlaylistPath || current.mp4Path || current.url) : null;
  const videoSrc = resolveSrc(raw);

  async function confirmBuy() {
    setBuying(true);
    try {
      const resp = await api.post(`/courses/${course._id}/buy`, { code });
      if (resp.data?.ok) {
        setShowBuy(false);
        setCode("");
        await load();
      } else {
        alert(resp.data?.error || "Purchase failed");
      }
    } catch (e) {
      alert(e?.response?.data?.error || "Purchase failed");
    } finally {
      setBuying(false);
    }
  }

  const priceText = (course.priceCents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" });

  const displayDuration = runtimeDurationSec != null ? Math.round(runtimeDurationSec) : Math.round(current?.durationSec || 0);

  // 🔧 NEW: description fallback logic — supports optional video.description
  const currentDescription = (current?.description && String(current.description).trim()) || "";

  return (
    <div className="courses">
      <div className="container">
        <div className="section-title">
          <div className="h2">{course.title}</div>
          {!canView ? (
            <button className="btn btn-primary" onClick={() => setShowBuy(true)}>
              Buy • {priceText}
            </button>
          ) : (
            <span className="badge">{purchased ? "Purchased" : "Creator/Admin access"}</span>
          )}
        </div>

        <div className="detail-layout">
          <div className="panel">
            {videoSrc ? (
              <div className="video-wrapper">
                <video
                  key={videoSrc}
                  ref={videoRef}
                  src={videoSrc}
                  controls
                  preload="metadata"
                  style={{ width: "100%", borderRadius: 12 }}
                  onLoadedMetadata={() => {
                    const dur = videoRef.current?.duration;
                    if (Number.isFinite(dur) && dur > 0) setRuntimeDurationSec(dur);
                  }}
                />
                <div className="video-title">{current?.title}</div>
                {!!currentDescription && <div className="video-note">{currentDescription}</div>}
                {displayDuration > 0 && <div className="muted">Duration: {displayDuration}s</div>}
              </div>
            ) : (
              <div className="video-wrapper" style={{ display: "grid", placeItems: "center", aspectRatio: "16/9" }}>
                {canView ? "Choose a lecture to play" : "Locked — purchase to watch"}
              </div>
            )}
          </div>

          <aside className="panel sticky-aside">
            <div className="curriculum">
              {course.modules.map((m, mi) => (
                <div className="module" key={mi}>
                  <div className="module-head">
                    <div className="module-title">{m.title || `Module ${mi + 1}`}</div>
                    <div className="muted">{m.videos?.length || 0} lectures</div>
                  </div>
                  <div className="module-body">
                    {(m.videos || []).map((v, vi) => {
                      const locked = !!v.locked || !canView;
                      const activeCls = active.m === mi && active.v === vi ? "active" : "";
                      const durLabel = activeCls && runtimeDurationSec != null ? Math.round(runtimeDurationSec) : Math.round(v.durationSec || 0);
                      return (
                        <div key={vi} className={`lesson ${locked ? "locked" : ""} ${activeCls}`}>
                          <div className="left">
                            <div className="lesson-title">{v.title}{locked ? " 🔒" : ""}</div>
                            <div className="lesson-sub">{(v.description || "No description")} · {durLabel > 0 ? `${durLabel}s` : "—"}</div>
                          </div>
                          <div className="right">
                            <button className="play" disabled={locked} onClick={() => setActive({ m: mi, v: vi })} aria-pressed={activeCls === "active"}>
                              {activeCls ? "Playing" : "Play"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {(!m.videos || m.videos.length === 0) && <div className="muted">No lectures yet.</div>}
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>

      {showBuy && (
        <div className="modal-overlay" onClick={() => !buying && setShowBuy(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="buy-title">
            <div id="buy-title" className="h2" style={{ fontSize: 20, marginBottom: 8 }}>Enter purchase code</div>
            <p className="muted" style={{ marginBottom: 10 }}>Use <b>syncpmo</b> during development.</p>
            <input className="input" placeholder="syncpmo" value={code} onChange={(e) => setCode(e.target.value)} />
            <div className="row" style={{ justifyContent: "flex-end", marginTop: 12 }}>
              <button className="btn" onClick={() => setShowBuy(false)} disabled={buying}>Cancel</button>
              <button className="btn btn-primary" onClick={confirmBuy} disabled={buying || !code.trim()}>
                {buying ? "Processing…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
