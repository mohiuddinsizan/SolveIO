import { useEffect, useState } from "react";
import { apiFeed } from "../lib/api";
import PostComposer from "../components/PostComposer";
import PostCard from "../components/PostCard";

export default function Feed() {
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const load = async (p = 1) => {
    setLoading(true);
    try {
      const data = await apiFeed(p, 20);
      if (p === 1) setPosts(data);
      else setPosts(prev => [...prev, ...data]);
      setPage(p);
    } catch (e) {
      alert(e?.response?.data?.error || "Failed to load feed");
    } finally { setLoading(false); }
  };

  useEffect(() => { load(1); }, []);

  return (
    <div className="container" style={{ maxWidth: 720 }}>
      <h2 className="h2" style={{ marginBottom: 12 }}>Newsfeed</h2>

      <PostComposer onPosted={() => load(1)} />

      {posts.map(p => <PostCard key={p._id} post={p} onRefresh={() => load(page)} />)}

      <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
        <button className="btn btn-outline" onClick={() => load(page + 1)} disabled={loading}>
          {loading ? "Loading…" : "Load more"}
        </button>
      </div>
    </div>
  );
}
