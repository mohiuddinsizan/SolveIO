// frontend/src/pages/AnalyticsAdmin.jsx
import { useEffect, useMemo, useState } from "react";
import api from "../lib/api";

// Recharts — make sure you have installed: npm i recharts
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from "recharts";

import "../styles/stats.css";

// distinct palette for great visibility
const COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#ef4444", "#06b6d4", "#8b5cf6", "#22c55e", "#f43f5e"];

// tiny util so we never render "undefined"
const money = (v) =>
  (typeof v === "number" && !Number.isNaN(v))
    ? v.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 })
    : "$0.00";

export default function AnalyticsAdmin() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await api.get("/stats/admin");
      setData(res.data || {});
    } catch (e) {
      setErr(e?.response?.data?.error || e.message || "Failed to load admin stats");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Safely unwrap fields with fallbacks
  const holding = useMemo(() => Number(data?.holding || 0), [data]);
  const profitTotal = useMemo(() => Number(data?.profitTotal || 0), [data]);

  const jobs = useMemo(() => ({
    open: Number(data?.jobs?.open || 0),
    assigned: Number(data?.jobs?.assigned || 0),
    awaiting: Number(data?.jobs?.["awaiting-approval"] || 0),
    completed: Number(data?.jobs?.completed || 0),
    disputed: Number(data?.jobs?.disputed || 0),
  }), [data]);

  // Combine assigned + awaiting-approval as "in progress"
  const inProgress = useMemo(() => jobs.assigned + jobs.awaiting, [jobs]);

  // trend data for chart (monthlyProfit: [{label, value}])
  const trend = useMemo(() => Array.isArray(data?.monthlyProfit) ? data.monthlyProfit.map((d) => ({
    label: d?.label ?? "",
    Profit: Number(d?.value || 0),
  })) : [], [data]);

  // pie data for orders
  const pieData = useMemo(() => ([
    { name: "Open", value: jobs.open },
    { name: "In Progress", value: inProgress },
    { name: "Completed", value: jobs.completed },
    { name: "Disputed", value: jobs.disputed },
  ]), [jobs, inProgress]);

  // bar data for orders
  const ordersBars = useMemo(() => ([
    { name: "Open", value: jobs.open },
    { name: "In Progress", value: inProgress },
    { name: "Completed", value: jobs.completed },
    { name: "Disputed", value: jobs.disputed },
  ]), [jobs, inProgress]);

  if (loading) return <div className="container">Loading…</div>;
  if (err) return <div className="container error">{err}</div>;

  return (
    <div className="container">
      <div className="section-title">
        <h2 className="h2">Platform Analytics (Admin)</h2>
        <div className="muted">Colorful, clear KPIs + profit trend.</div>
      </div>

      {/* KPI Row */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Holding (in escrow)</div>
          <div className="kpi-value">{money(holding)}</div>
          <div className="kpi-sub">Funds currently held by company</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Profit (5% fees)</div>
          <div className="kpi-value">{money(profitTotal)}</div>
          <div className="kpi-sub">Sum of fees from released escrows</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Orders: In Progress</div>
          <div className="kpi-value">{inProgress}</div>
          <div className="kpi-sub">Assigned + Awaiting Approval</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Orders: Completed</div>
          <div className="kpi-value">{jobs.completed}</div>
          <div className="kpi-sub">All-time</div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="charts-grid">
        <div className="chart-card">
          <div className="chart-title">Monthly Profit (last 6 months)</div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="4 4" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip formatter={(v) => money(v)} />
              <Legend />
              <Line type="monotone" dataKey="Profit" stroke={COLORS[0]} strokeWidth={3} dot />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <div className="chart-title">Orders by Status</div>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={100} label>
                {pieData.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <div className="chart-title">Orders by Status (Bar)</div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={ordersBars}>
              <CartesianGrid strokeDasharray="4 4" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="value" name="Count">
                {ordersBars.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}