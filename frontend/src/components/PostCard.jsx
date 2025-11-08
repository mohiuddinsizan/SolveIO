import { useState } from "react";
import { Link } from "react-router-dom";
import { apiReactPost, apiCommentPost } from "../lib/api";

export default function PostCard({ post, onRefresh }) {
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const author = post.author || post.authorId; // backend might send either

  const like = async () => {
    if (busy) return;
    setBusy(true);
    try { await apiReactPost(post._id); onRefresh && onRefresh(); }
    catch (e) { alert(e?.response?.data?.error || "Failed"); }
    finally { setBusy(false); }
  };

  const addComment = async () => {
    if (busy || !comment.trim()) return;
    setBusy(true);
    try {
      await apiCommentPost(post._id, comment.trim());
      setComment("");
      onRefresh && onRefresh();
    } catch (e) {
      alert(e?.response?.data?.error || "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      {/* header */}
      <div className="job-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div className="avatar sm">
          {(author?.name || "U").split(" ").slice(0,2).map(x=>x[0]).join("").toUpperCase()}
        </div>
        <div>
          <Link to={`/u/${author?._id}`} className="h4" style={{ textDecoration: "none" }}>
            {author?.name || "User"}
          </Link>
          <div className="muted" style={{ fontSize: 12 }}>
            {post.createdAt ? new Date(post.createdAt).toLocaleString() : ""}
          </div>
        </div>
      </div>

      {/* text */}
      {post.text && (
        <div className="mt-2" style={{ whiteSpace: "pre-wrap" }}>{post.text}</div>
      )}

      {/* images */}
      {Array.isArray(post.images) && post.images.length > 0 && (
        <div className="mt-2" style={{ display:"grid", gap:8, gridTemplateColumns:"repeat(4, 1fr)" }}>
          {post.images.map((img, i) => (
            <img
              key={i}
              src={img?.url}
              alt=""
              style={{ width:"100%", height:220, objectFit:"cover", borderRadius:8 }}
              loading="lazy"
            />
          ))}
        </div>
      )}

      {/* reactions/comments meta */}
      <div className="job-meta mt-2">
        <span className="chip">❤️ {post.reactionsCount ?? (post.reactions?.length || 0)}</span>
        <span className="chip">💬 {post.commentsCount ?? (post.comments?.length || 0)}</span>
        <button className="btn btn-outline" onClick={like}>React</button>
      </div>

      {/* write comment */}
      <div className="mt-2" style={{ display: "flex", gap: 8 }}>
        <input
          className="input"
          placeholder="Write a comment…"
          value={comment}
          onChange={(e)=>setComment(e.target.value)}
        />
        <button className="btn btn-primary" onClick={addComment} disabled={!comment.trim()}>Comment</button>
      </div>

      {/* comment list */}
      {Array.isArray(post.comments) && post.comments.length > 0 && (
        <div className="mt-2" style={{ display:"grid", gap:8 }}>
          {post.comments.map((c, i) => {
            const cu = c.user || c.userId; // might be populated or raw id
            return (
              <div key={i} style={{ display:"flex", gap:8, alignItems:"flex-start" }}>
                <div className="avatar xs">
                  {(cu?.name || "U").split(" ").slice(0,2).map(x=>x[0]).join("").toUpperCase()}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", gap:6, alignItems:"baseline" }}>
                    <Link to={`/u/${cu?._id}`} className="h5" style={{ textDecoration:"none" }}>
                      {cu?.name || "User"}
                    </Link>
                    <span className="muted" style={{ fontSize:12 }}>
                      {c.createdAt ? new Date(c.createdAt).toLocaleString() : ""}
                    </span>
                  </div>
                  <div style={{ whiteSpace:"pre-wrap" }}>{c.text}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
