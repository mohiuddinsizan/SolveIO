import "../styles/dashboard.css";

export default function DashboardAdmin(){
  return (
    <div className="container">
      <div className="section">
        <div className="section-title">
          <h2 className="h2">Admin Dashboard</h2>
          <span className="badge">Oversight</span>
        </div>
        <div className="cards">
          <div className="card"><b>Users</b><div className="muted mt-1">Totals (Day 7)</div></div>
          <div className="card"><b>Jobs</b><div className="muted mt-1">By status (Day 7)</div></div>
          <div className="card"><b>Flags</b><div className="muted mt-1">Risk/Fairness (Day 7)</div></div>
        </div>
      </div>
    </div>
  );
}
