// frontend/src/pages/ProfileAdmin.jsx
import { useEffect, useState } from "react";
import api from "../lib/api";
import "../styles/profile.css";

export default function ProfileAdmin(){
  const [me, setMe] = useState(null);
  const [err, setErr] = useState("");

  const load = async () => {
    setErr("");
    try {
      const { data } = await api.get("/me/profile");
      setMe(data.user);
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
    </div>
  );
}
