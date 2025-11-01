import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import "../styles/orders.css";

export default function OrdersFreelancer(){
  const [tab,setTab]=useState("requested");
  const [data,setData]=useState({requested:[],inProgress:[],completed:[],rejected:[]});

  const load = async ()=> {
    const { data } = await api.get("/orders/freelancer");
    setData(data);
  };
  useEffect(()=>{ load(); },[]);

  const Section = ({items, empty}) => (
    <div className="order-list">
      {items.length===0 && <div className="muted">{empty}</div>}
      {items.map((x)=> {
        const j = x.job || x;
        const escrow = j.escrow || x.escrow;
        return (
          <Link
            to={`/jobs/${j._id}${(j.status==="assigned"||j.status==="awaiting-approval") ? "#chat":""}`}
            className="order-card"
            key={x._id || j._id}
            style={{textDecoration:"none"}}
          >
            <div className="order-head">
              <div className="job-title">{j.title}</div>
              <span className="badge">${j.budget}</span>
            </div>
            <div className="order-meta mt-1">
              <span className="badge">{j.status}</span>
              {x.status && tab!=="completed" && <span className="small">Application: {x.status}{x.rejectMessage?` — ${x.rejectMessage}`:""}</span>}
              {j.status === "completed" && (
                <>
                  <span className="small">Payout: ${escrow?.payout ?? (j.budget*0.95).toFixed(2)}</span>
                  <span className="small">Fee kept by company: 5%</span>
                  {j.ratingEmployerToFreelancer?.score && (
                    <span className="small">Employer→Me: {j.ratingEmployerToFreelancer.score}★ — {j.ratingEmployerToFreelancer.comment}</span>
                  )}
                  {j.ratingFreelancerToEmployer?.score && (
                    <span className="small">My Rating→Employer: {j.ratingFreelancerToEmployer.score}★ — {j.ratingFreelancerToEmployer.comment}</span>
                  )}
                </>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );

  return (
    <div className="container">
      <div className="section-title">
        <h2 className="h2">My Work (Freelancer)</h2>
      </div>
      <div className="tabs">
        {["requested","inProgress","completed","rejected"].map(t=>(
          <button key={t} className={`tab ${tab===t?"active":""}`} onClick={()=>setTab(t)}>{t}</button>
        ))}
      </div>

      {tab==="requested"  && <Section items={data.requested}  empty="No pending applications." />}
      {tab==="inProgress" && <Section items={data.inProgress} empty="No accepted jobs yet. Click a job to open chat & submission." />}
      {tab==="completed"  && <Section items={data.completed}  empty="No completed jobs yet." />}
      {tab==="rejected"   && <Section items={data.rejected}   empty="No rejections." />}
    </div>
  );
}
