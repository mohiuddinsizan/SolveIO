// frontend/src/pages/SkillDevelopment.jsx
import { useEffect, useState } from "react";
import api from "../lib/api";
import {
    ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
    BarChart, Bar, Cell
} from "recharts";
import Stars from "../components/Stars";
import "../styles/stats.css";
import "../styles/jobs.css";

const COLORS = ["#4f46e5", "#16a34a", "#f59e0b", "#ef4444", "#06b6d4", "#8b5cf6", "#22c55e", "#f43f5e"];
const fmtDate = (d) => { try { return new Date(d).toLocaleDateString(); } catch { return ""; } };

export default function SkillDevelopment() {
    const [data, setData] = useState(null);
    const [err, setErr] = useState("");

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                setErr("");
                const { data } = await api.get("/ai/skill-development");
                if (mounted) setData(data);
            } catch (e) {
                setErr(e?.response?.data?.error || "Failed to load skill development data");
            }
        })();
        return () => { mounted = false; };
    }, []);

    if (err) return <div className="container"><div className="error">{err}</div></div>;
    if (!data) return <div className="container">Loading…</div>;

    const received = (data.ratings?.received || []).map(r => ({ date: fmtDate(r.at), received: r.rating }));
    const given = (data.ratings?.given || []).map(r => ({ date: fmtDate(r.at), given: r.rating }));
    // merge by date index for chart
    const byDate = new Map();
    for (const r of received) byDate.set(r.date, { date: r.date, received: r.received, given: undefined });
    for (const g of given) {
        const prev = byDate.get(g.date) || { date: g.date };
        prev.given = g.given;
        byDate.set(g.date, prev);
    }
    const timeline = Array.from(byDate.values());

    const demand = data.demand || [];
    const demandBars = demand.map(d => ({ name: d.name, count: d.count }));

    return (
        <div className="container">
            <div className="section-title" style={{ alignItems: "flex-end" }}>
                <div>
                    <h2 className="h2">Skill Development</h2>
                    <div className="muted">Insights from completed jobs, both sides’ ratings, and current market demand.</div>
                </div>
                <div className="chip">
                    Overall: <Stars value={data.user?.ratingAvg || 0} /> ({data.user?.ratingCount || 0})
                </div>
            </div>

            <div className="kpi-grid">
                <div className="kpi-card">
                    <div className="kpi-label">Completed Jobs</div>
                    <div className="kpi-value">{data.summary?.completedCount || 0}</div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-label">Avg (received)</div>
                    <div className="kpi-value"><Stars value={data.summary?.avgRatingReceived || 0} /></div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-label">Recent (last 3, received)</div>
                    <div className="kpi-value"><Stars value={data.summary?.recentAvgReceived || 0} /></div>
                </div>
            </div>

            <div className="charts-grid">
                <div className="chart-card">
                    <div className="chart-title">Ratings Timeline (Received vs Given)</div>
                    <div style={{ width: "100%", height: 300 }}>
                        <ResponsiveContainer>
                            <LineChart data={timeline} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" />
                                <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} />
                                <Tooltip />
                                <Legend />
                                <Line type="monotone" dataKey="received" name="Received (Employer → You)" stroke="#4f46e5" strokeWidth={2} dot />
                                <Line type="monotone" dataKey="given" name="Given (You → Employer)" stroke="#16a34a" strokeWidth={2} dot />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="chart-card">
                    <div className="chart-title">In-Demand Skills/Tags (market)</div>
                    <div style={{ width: "100%", height: 300 }}>
                        <ResponsiveContainer>
                            <BarChart data={demandBars} margin={{ top: 10, right: 20, left: -10, bottom: 60 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" angle={-35} textAnchor="end" interval={0} height={80} />
                                <YAxis allowDecimals={false} />
                                <Tooltip />
                                <Bar dataKey="count">
                                    {demandBars.map((_, idx) => (
                                        <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="section-card" style={{ marginTop: 16 }}>
                <h3 className="h3">Employer Feedback (from completed jobs)</h3>
                {(!data.feedback || data.feedback.length === 0) && (
                    <div className="muted">No feedback yet.</div>
                )}
                {data.feedback?.map((f, i) => (
                    <div key={i} className="panel" style={{ marginTop: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                            <div><b>{f.jobTitle}</b> <span className="muted">by {f.employer}</span></div>
                            {Number.isFinite(f.rating) && <div><strong>{f.rating}</strong>/5</div>}
                        </div>
                        <div className="mt-1" style={{ whiteSpace: "pre-wrap" }}>{f.comment}</div>
                        <div className="muted" style={{ marginTop: 4 }}>{fmtDate(f.at)}</div>
                    </div>
                ))}
            </div>

            <div className="section-card" style={{ marginTop: 16 }}>
                <h3 className="h3">AI Summary & Action Plan</h3>
                <ul className="mt-2">
                    <li>
                        <b>Lift “received” ratings:</b> look for repeating notes in feedback and fix them next job (e.g., timeline updates, QA checklist, clearer scope).
                    </li>
                    <li>
                        <b>Target market demand:</b> {(data.demand || []).slice(0, 6).map(d => d.name).join(", ") || "—"}.
                        Update your profile/portfolio to highlight these.
                    </li>
                    <li>
                        <b>Close the loop:</b> if you gave low ratings to employers, add contract safeguards (milestones, acceptance criteria) to reduce friction.
                    </li>
                </ul>
            </div>

            <div className="section-card" style={{ marginTop: 16 }}>
                <h3 className="h3">Suggested Courses (matched to in-demand skills)</h3>
                {(!data.courseSuggestions || data.courseSuggestions.length === 0) && (
                    <div className="muted">No course suggestions right now.</div>
                )}
                <div className="job-list" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
                    {data.courseSuggestions?.map((c, idx) => (
                        <a key={idx} href={`/courses/${c._id}`} className="job-card" style={{ textDecoration: "none" }}>
                            <div className="job-title" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                {c.thumbnailUrl && (
                                    <img
                                        src={c.thumbnailUrl}
                                        alt={c.title}
                                        style={{ width: 40, height: 40, borderRadius: 6, objectFit: "cover" }}
                                    />
                                )}
                                <span>{c.title}</span>
                            </div>
                            <div className="job-desc">
                                {(c.description || "").slice(0, 130)}
                                {String(c.description || "").length > 130 ? "…" : ""}
                            </div>
                            {/* inside the course card, under description */}
                            {Array.isArray(c.matched) && c.matched.length > 0 && (
                                <div className="muted" style={{ marginTop: 6 }}>
                                    Matches: {c.matched.slice(0, 4).join(", ")}
                                </div>
                            )}

                            <div className="job-meta">
                                {Array.isArray(c.tags) && c.tags.slice(0, 5).map(t => (
                                    <span key={t} className="job-tag">{t}</span>
                                ))}
                                <span className="badge">Price: ${(Number(c.priceCents || 0) / 100).toFixed(2)}</span>
                            </div>
                        </a>
                    ))}
                </div>
            </div>
        </div>
    );
}
