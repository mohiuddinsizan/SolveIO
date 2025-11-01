import { useEffect, useState } from "react";
import api from "../lib/api";
import { useAuth } from "../store/auth";
import Stars from "../components/Stars";
import "../styles/profile.css";

export default function ProfileEmployer(){
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    (async ()=>{
      const { data } = await api.get("/me/profile");
      setProfile(data.user);
    })();
  }, []);

  if (!profile) return <div className="container">Loading…</div>;
  if (user?.role !== "employer") return <div className="container">Only employers can view this page.</div>;

  const initials = (profile?.name || "E").split(" ").slice(0,2).map(x=>x[0]).join("").toUpperCase();

  return (
    <div className="container profile-wrap">
      <div className="profile-header">
        <div className="avatar">{initials}</div>
        <div style={{flex:1}}>
          <div className="h2">{profile.name}</div>
          <div className="meta">
            <span className="chip">{profile.email}</span>
            <span className="chip">Rating: <Stars value={profile.ratingAvg || 0} /> ({profile.ratingCount || 0})</span>
            <span className="chip">Member since: {new Date(profile.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      <div className="section-card">
        <h3 className="h3">About</h3>
        <p className="muted">Employers’ ratings are based on feedback from freelancers after completed jobs.</p>
      </div>
    </div>
  );
}
