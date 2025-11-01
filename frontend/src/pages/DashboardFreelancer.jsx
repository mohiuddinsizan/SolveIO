import "../styles/dashboard.css";

export default function DashboardFreelancer(){
  return (
    <div className="container">
      <div className="section">
        <div className="section-title">
          <h2 className="h2">Freelancer Dashboard</h2>
          <span className="badge">Performance</span>
        </div>
        <div className="cards">
          <div className="card kpi">
            <span className="label">Acceptance rate</span>
            <span className="value">—</span>
          </div>
          <div className="card kpi">
            <span className="label">On-time delivery</span>
            <span className="value">—</span>
          </div>
          <div className="card kpi">
            <span className="label">Reliability score</span>
            <span className="value">—</span>
          </div>

          <div className="card"><b>My Applications</b><div className="muted mt-1">Day 2+</div></div>
          <div className="card"><b>Active Jobs</b><div className="muted mt-1">Day 3+</div></div>
          <div className="card"><b>AI Tips</b><div className="muted mt-1">Day 5+</div></div>
        </div>
      </div>
    </div>
  );
}
