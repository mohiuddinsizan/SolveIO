import "../styles/landing.css";

export default function Landing() {
  return (
    <div className="hero">
      <div className="hero-box">
        <h1 className="h1 mb-2">SyncPmo</h1>
        <p className="muted">
          Fair, transparent, AI-powered gig work. Create your account or sign in to continue.
        </p>
        <div className="hero-actions">
          <a href="/login" className="btn btn-primary">Login</a>
          <a href="/signup" className="btn btn-outline">Sign up</a>
        </div>
      </div>
    </div>
  );
}
