// src/components/OrdersEmployer.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import "../styles/orders.css";

export default function OrdersEmployer(){
  const [tab,setTab]=useState("requested");
  const [data,setData]=useState({requested:[],inProgress:[],completed:[]});

  const load = async ()=> {
    const { data } = await api.get("/orders/employer");
    setData(data);
  };
  useEffect(()=>{ load(); },[]);

  const Section = ({items, empty}) => (
    <div className="order-list">
      {items.length===0 && <div className="muted">{empty}</div>}
      {items.map((x)=> {
        const j = x.job || x; // requested has { job, ... }
        const escrow = j.escrow || x.escrow;
        const goChatHash = (j.status==="assigned"||j.status==="awaiting-approval") ? "#chat" : "";
        return (
          <Link
            to={`/jobs/${j._id}${goChatHash}`}
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
              {x.proposal && <span className="small">Applicant: {x.freelancerId?.name}</span>}
              {j.status === "completed" && (
                <>
                  <span className="small">Payout: ${escrow?.payout ?? (j.budget*0.95).toFixed(2)}</span>
                  <span className="small">Fee (5%): ${escrow?.fee ?? (j.budget*0.05).toFixed(2)}</span>
                  {j.ratingEmployerToFreelancer?.score && (
                    <span className="small">My Rating→Freelancer: {j.ratingEmployerToFreelancer.score}★ — {j.ratingEmployerToFreelancer.comment}</span>
                  )}
                  {j.ratingFreelancerToEmployer?.score && (
                    <span className="small">Freelancer→Me: {j.ratingFreelancerToEmployer.score}★ — {j.ratingFreelancerToEmployer.comment}</span>
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
        <h2 className="h2">My Orders (Employer)</h2>
      </div>
      <div className="tabs">
        {["requested","inProgress","completed"].map(t=>(
          <button key={t} className={`tab ${tab===t?"active":""}`} onClick={()=>setTab(t)}>{t}</button>
        ))}
      </div>
      {tab==="requested"  && <Section items={data.requested}  empty="No incoming requests." />}
      {tab==="inProgress" && <Section items={data.inProgress} empty="No in-progress jobs. Click a job to open details, chat & approvals." />}
      {tab==="completed"  && <Section items={data.completed}  empty="No completed jobs yet." />}
    </div>
  );
}