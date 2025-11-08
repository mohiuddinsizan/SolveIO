import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api, { apiPostsByUser, apiFollowers, apiFollowing } from "../lib/api";
import FollowButton from "../components/FollowButton";
import PostCard from "../components/PostCard";

export default function UserPublicProfile() {
  const { id } = useParams();
  const [info, setInfo] = useState(null);
  const [posts, setPosts] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);

  const load = async () => {
    const { data } = await api.get(`/users/${id}`); // we’ll add a tiny read-only endpoint below
    setInfo(data);
    setPosts(await apiPostsByUser(id, 1, 20));
    setFollowers(await apiFollowers(id));
    setFollowing(await apiFollowing(id));
  };

  useEffect(() => { if (id) load(); }, [id]);

  if (!info) return <div className="container">Loading…</div>;

  const initials = (info?.name || "U").split(" ").slice(0,2).map(x=>x[0]).join("").toUpperCase();

  return (
    <div className="container" style={{ maxWidth: 780 }}>
      <div className="profile-header">
        <div className="avatar">{initials}</div>
        <div style={{ flex: 1 }}>
          <div className="h2">{info.name}</div>
          <div className="meta">
            <span className="chip">{info.email}</span>
            <span className="chip">Role: {info.role}</span>
            <span className="chip">Joined: {new Date(info.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
        <FollowButton userId={id} onChange={() => { /* optionally refresh counts */ }} />
      </div>

      <div className="section-card">
        <div className="job-meta">
          <span className="chip">Followers: {followers.length}</span>
          <span className="chip">Following: {following.length}</span>
        </div>
      </div>

      <div className="section-card">
        <h3 className="h3">Posts</h3>
        <div className="mt-2">
          {posts.length === 0 ? <div className="muted">No posts yet.</div> :
            posts.map(p => <PostCard key={p._id} post={p} onRefresh={load} />)}
        </div>
      </div>
    </div>
  );
}
