import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { apiFollowers, apiFollowing, apiPostsByUser } from "../lib/api";
import PostComposer from "../components/PostComposer";
import PostCard from "../components/PostCard";
import "../styles/profile.css";

export default function ProfileAdmin(){
  const [me, setMe] = useState(null);
  const [err, setErr] = useState("");

  // social
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [posts, setPosts] = useState([]);
  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);

  const load = async () => {
    setErr("");
    try {
      const { data } = await api.get("/me/profile");
      setMe(data.user);

      if (data?.user?._id) {
        const uid = data.user._id;
        try { setFollowers(await apiFollowers(uid)); } catch {}
        try { setFollowing(await apiFollowing(uid)); } catch {}
        try { setPosts(await apiPostsByUser(uid, 1, 20)); } catch {}
      }
    } catch (e) {
      setErr(e?.response?.data?.error || "Failed to load profile");
    }
  };

  useEffect(() => { load(); }, []);

  if (err) return <div className="container">Error: {err}</div>;
  if (!me) return <div className="container">Loading…</div>;

  const initials = (me.name || "A").split(" ").slice(0,2).map(x=>x[0]).join("").toUpperCase();

  return (
    <div className="container profile-wrap">
      <div className="profile-header">
        <div className="avatar">{initials}</div>
        <div style={{flex:1}}>
          <div className="h2">{me.name}</div>
          <div className="meta">
            <span className="chip">{me.email}</span>
            <span className="chip">Role: Admin</span>
            <span className="chip">Wallet: ${Number(me.walletBalance||0).toFixed(2)}</span>
            <span className="chip">Holding: ${Number(me.holdingTotal||0).toFixed(2)}</span>
            <span className="chip">Profit: ${Number(me.profitTotal||0).toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="section-card">
        <h3 className="h3">About the financials</h3>
        <p className="muted">
          <b>Holding</b> is the total money in funded escrows (not yet released).{" "}
          <b>Profit</b> is fees earned from released escrows. <b>Wallet</b> is the realized money currently available.
        </p>
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
