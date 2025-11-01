import "../styles/dashboard.css";

export default function DashboardEmployer(){
  return (
    <div className="container">
      <div className="section">
        <div className="section-title">
          <h2 className="h2">Employer Dashboard</h2>
          <a href="/jobs/new" className="btn btn-primary">Post Job</a>
        </div>
        <div className="cards">
          <div className="card"><b>Open Jobs</b><div className="muted mt-1">Day 2</div></div>
          <div className="card"><b>Assigned</b><div className="muted mt-1">Day 3</div></div>
          <div className="card"><b>Finished</b><div className="muted mt-1">Day 3</div></div>
        </div>
      </div>
    </div>
  );
}
