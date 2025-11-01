import { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import Stars from "../components/Stars";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend
} from "recharts";
import "../styles/stats.css";

const COLORS = ["#4f46e5", "#16a34a", "#f59e0b", "#ef4444", "#06b6d4", "#8b5cf6", "#22c55e", "#f43f5e"];

// tiny util so we never render "undefined"
const money = (v) =>
  (typeof v === "number" && !Number.isNaN(v))
    ? v.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 })
    : "$0.00";

export default function AnalyticsFreelancer() {
  const [range, setRange] = useState("all");
  const [data, setData] = useState({
    jobsByStatus: [],
    releasedWallet: { amount: 0, count: 0 },
    recent: []
  });
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const params = useMemo(() => {
    if (range === "day") {
      const from = new Date(); from.setHours(0,0,0,0);
      return { from: from.toISOString() };
    }
    if (range === "month") {
      const from = new Date(); from.setDate(1); from.setHours(0,0,0,0);
      return { from: from.toISOString() };
    }
    return {};
  }, [range]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const [resStats, resProfile] = await Promise.all([
          api.get("/stats/freelancer", { params }),
          api.get("/me/profile")
        ]);
        if (!mounted) return;
        // Ensure sane defaults in case backend omits fields
        const payload = resStats?.data || {};
        setData({
          jobsByStatus: Array.isArray(payload.jobsByStatus) ? payload.jobsByStatus : [],
          releasedWallet: payload.releasedWallet ?? { amount: 0, count: 0 },
          recent: Array.isArray(payload.recent) ? payload.recent : []
        });
        setProfile(resProfile?.data?.user || null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [params]);

  const jobs = Array.isArray(data.jobsByStatus) ? data.jobsByStatus : [];

  const byStatus = jobs.reduce(
    (acc, x) => ({ ...acc, [x._id]: x.count }),
    {} // initial accumulator prevents empty-array error
  );
  const amountByStatus = jobs.reduce(
    (acc, x) => ({ ...acc, [x._id]: x.amount }),
    {}
  );

  const pieData = Object.entries(byStatus).map(([name, value]) => ({ name, value }));
  const barData = Object.entries(amountByStatus).map(([label, value]) => ({ label, value }));

  if (loading) return <div className="container">Loading…</div>;

  return (
    <div className="container">
      <div className="section-title">
        <h2 className="h2">Freelancer Analytics</h2>
        <div className="controls">
          <select className="select" value={range} onChange={e => setRange(e.target.value)}>
            <option value="all">All time</option>
            <option value="day">Today</option>
            <option value="month">This month</option>
          </select>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Completed Jobs</div>
          <div className="kpi-value text-success">{byStatus["completed"] || 0}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Released Earnings</div>
          <div className="kpi-value text-success">{money(data.releasedWallet?.amount ?? 0)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">My Rating</div>
          <div className="kpi-value"><Stars value={profile?.ratingAvg || 0} /> ({profile?.ratingCount || 0})</div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <div className="chart-title">Jobs Breakdown</div>
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={100} label>
                  {pieData.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-title">Earnings by Status</div>
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={barData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis allowDecimals={false} />
                <Tooltip formatter={(v) => money(v)} />
                <Bar dataKey="value">
                  {barData.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}