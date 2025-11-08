import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { apiFollowers, apiFollowing, apiPostsByUser } from "../lib/api";
import { useAuth } from "../store/auth";
import MultiSelect from "../components/MultiSelect";
import Stars from "../components/Stars";
import PostComposer from "../components/PostComposer";
import PostCard from "../components/PostCard";
import "../styles/forms.css";
import "../styles/profile.css";

export default function ProfileFreelancer(){
  const { user } = useAuth();
  const [meta, setMeta] = useState({ skills: [] });
  const [profile, setProfile] = useState(null);
  const [skills, setSkills] = useState([]);
  const [msg, setMsg] = useState("");

  // social
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [posts, setPosts] = useState([]);
  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);

  const load = async () => {
    const metaRes = await api.get("/meta");
    setMeta(metaRes.data);
    const { data } = await api.get("/me/profile");
    setProfile(data.user);
    setSkills(data.user.skills || []);

    if (data?.user?._id) {
      const uid = data.user._id;
      try { setFollowers(await apiFollowers(uid)); } catch {}
      try { setFollowing(await apiFollowing(uid)); } catch {}
      try { setPosts(await apiPostsByUser(uid, 1, 20)); } catch {}
    }
  };

  useEffect(()=>{ load(); }, []);

  if (!profile) return <div className="container">Loading…</div>;
  if (user?.role !== "worker") return <div className="container">Only freelancers can view this page.</div>;

  const initials = (profile?.name || "F").split(" ").slice(0,2).map(x=>x[0]).join("").toUpperCase();

  return (
    <div className="container profile-wrap">
      <div className="profile-header">
        <div className="avatar">{initials}</div>
        <div style={{flex:1}}>
          <div className="h2">{profile.name}</div>
          <div className="meta">
            <span className="chip">{profile.email}</span>
            <span className="chip">Rating: <Stars value={profile.ratingAvg || 0} /> ({profile.ratingCount || 0})</span>
            <span className="chip">Wallet: ${Number(profile.walletBalance || 0).toFixed(2)}</span>
            <span className="chip">Member since: {new Date(profile.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      <div className="section-card">
        <h3 className="h3">Earnings</h3>
        <div className="earn-grid">
          <div className="earn-card">
            <div className="label">Earned (payouts)</div>
            <div className="value">${Number(profile.earnedTotal || 0).toFixed(2)}</div>
          </div>
          <div className="earn-card">
            <div className="label">Tips</div>
            <div className="value">${Number(profile.tipTotal || 0).toFixed(2)}</div>
          </div>
          <div className="earn-card">
            <div className="label">Total</div>
            <div className="value">${Number(profile.totalEarned || 0).toFixed(2)}</div>
          </div>
        </div>
      </div>

      <div className="section-card">
        <h3 className="h3">Skills</h3>
        <p className="muted">Choose from the approved skills list. These are used for matching & discovery.</p>
        <div className="mt-2">
          <MultiSelect
            label=""
            options={meta.skills}
            values={skills}
            onChange={setSkills}
            placeholder="Select your skills…"
          />
        </div>
        <div className="save-row mt-2">
          <button className="btn btn-primary" onClick={async ()=>{
            setMsg("");
            try { await api.put("/me/skills", { skills }); setMsg("Saved ✓"); await load(); }
            catch (e) { setMsg(e?.response?.data?.error || "Failed to save"); }
          }}>Save</button>
          {msg && <span className="muted">{msg}</span>}
        </div>
      </div>

      {/* ---- Social section (toggle buttons + lists) ---- */}
      <div className="section-card">
        <div className="job-meta" style={{ gap: 8 }}>
          <button className="btn btn-outline" onClick={() => { setShowFollowers(v=>!v); setShowFollowing(false); }}>
            Followers ({followers.length})
          </button>
          <button className="btn btn-outline" onClick={() => { setShowFollowing(v=>!v); setShowFollowers(false); }}>
            Following ({following.length})
          </button>
        </div>

        {showFollowers && (
          <div className="panel mt-2">
            {followers.length === 0 ? <div className="muted">No followers yet.</div> :
              followers.map(f => (
                <Link key={f._id} to={`/u/${f.user._id}`} className="job-card">
                  <div className="job-title">{f.user.name}</div>
                  <div className="muted">{f.user.email} • {f.user.role}</div>
                </Link>
              ))
            }
          </div>
        )}

        {showFollowing && (
          <div className="panel mt-2">
            {following.length === 0 ? <div className="muted">Not following anyone.</div> :
              following.map(f => (
                <Link key={f._id} to={`/u/${f.user._id}`} className="job-card">
                  <div className="job-title">{f.user.name}</div>
                  <div className="muted">{f.user.email} • {f.user.role}</div>
                </Link>
              ))
            }
          </div>
        )}
      </div>

      <div className="section-card">
        <h3 className="h3">Your Posts</h3>
        <PostComposer onPosted={load} />
        <div className="mt-2">
          {posts.length === 0 ? <div className="muted">No posts yet.</div> :
            posts.map(p => <PostCard key={p._id} post={p} onRefresh={load} />)}
        </div>
      </div>
    </div>
  );
}
