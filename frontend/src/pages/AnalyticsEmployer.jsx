// frontend/src/pages/AnalyticsEmployer.jsx
import { useEffect, useState } from "react";
import api from "../lib/api";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend
} from "recharts";
import "../styles/stats.css";

const COLORS = ["#4f46e5", "#16a34a", "#f59e0b", "#ef4444", "#06b6d4", "#8b5cf6", "#22c55e", "#f43f5e"];

export default function AnalyticsEmployer() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const { data } = await api.get("/stats/employer");
      setStats({
        totalPosted: Number(data?.totalPosted || 0),
        open: Number(data?.open || 0),
        inProgress: Number(data?.inProgress || 0),
        completed: Number(data?.completed || 0),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div className="container">Loading…</div>;
  if (!stats) return <div className="container">No data</div>;

  const tiles = [
    { label: "Total Posted", value: String(stats.totalPosted) },
    { label: "Open",         value: String(stats.open) },
    { label: "In Progress",  value: String(stats.inProgress) },
    { label: "Completed",    value: String(stats.completed) },
  ];

  const pieData = [
    { name: "Open", value: stats.open },
    { name: "In Progress", value: stats.inProgress },
    { name: "Completed", value: stats.completed },
  ];

  // Simple bar data using the same counts (works even if you add timeseries later)
  const barData = [
    { label: "Open", value: stats.open },
    { label: "In Progress", value: stats.inProgress },
    { label: "Completed", value: stats.completed },
  ];

  return (
    <div className="container">
      <div className="section-title">
        <h2 className="h2">Employer Analytics</h2>
        <p className="muted">Overview of your posted jobs.</p>
      </div>

      <div className="kpi-grid">
        {tiles.map((t, i) => (
          <div key={i} className="kpi-card">
            <div className="kpi-value">{t.value}</div>
            <div className="kpi-label">{t.label}</div>
          </div>
        ))}
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
          <div className="chart-title">Status Counts</div>
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={barData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis allowDecimals={false} />
                <Tooltip />
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