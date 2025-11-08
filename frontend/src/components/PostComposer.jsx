import { useState, useMemo } from "react";
import { apiCreatePost } from "../lib/api";

export default function PostComposer({ onPosted }) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);

  const pick = (e) => {
    const arr = Array.from(e.target.files || []);
    setFiles(arr.slice(0, 5)); // backend limit
  };

  const removeAt = (i) => {
    setFiles(prev => prev.filter((_, idx) => idx !== i));
  };

  const canSubmit = useMemo(() => {
    return !!text.trim() || files.length > 0;
  }, [text, files]);

  const post = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      await apiCreatePost({ text: text.trim(), images: files });
      setText("");
      setFiles([]);
      onPosted && onPosted();
    } catch (e) {
      alert(e?.response?.data?.error || "Failed to post");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel" style={{ marginBottom: 12 }}>
      <textarea
        className="input"
        rows={3}
        placeholder="Share something with your network…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
        <label className="btn btn-outline">
          Attach images
          <input type="file" accept="image/*" multiple onChange={pick} style={{ display: "none" }} />
        </label>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button className="btn btn-primary" onClick={post} disabled={loading || !canSubmit}>
            {loading ? "Posting…" : "Post"}
          </button>
        </div>
      </div>

      {files.length > 0 && (
        <div style={{display:"grid", gap:8, gridTemplateColumns:"repeat(4, 1fr)", marginTop:10}}>
          {files.map((f, i)=>(
            <div key={i} style={{position:"relative", border:"1px solid var(--border)", borderRadius:10, overflow:"hidden", background:"#0f1420"}}>
              <img
                src={URL.createObjectURL(f)}
                alt={f.name}
                style={{width:"100%", height:160, objectFit:"cover", display:"block"}}
              />
              <div style={{fontSize:12, color:"var(--text-dim)", padding:"4px 8px", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
                <span title={f.name} style={{overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:"70%"}}>{f.name}</span>
                <button className="btn btn-xs" onClick={()=>removeAt(i)}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
