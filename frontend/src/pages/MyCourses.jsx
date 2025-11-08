import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import "../styles/courses.css";

export default function MyCourses() {
  const [data, setData] = useState({ created: [], purchased: [] });

  useEffect(() => {
    api.get("/my/courses").then((res) => setData(res.data));
  }, []);

  return (
    <div className="courses">
      <div className="container">
        <div className="section-title">
          <h2 className="h2">My Courses</h2>
        </div>

        <h3 className="muted" style={{ margin: "12px 0" }}>Created by me</h3>
        <div className="course-grid">
          {data.created.map((c) => (
            <Link key={c._id} to={`/courses/${c._id}`} className="course-card">
              <img src={c.thumbnailUrl || "/fallback.jpg"} alt="" className="course-thumb" />
              <div className="course-title">{c.title}</div>
              <div className="course-desc">{c.description?.slice(0, 80)}</div>
              <div className="purchase-actions">
                <span className="pill">${(c.priceCents / 100).toFixed(2)}</span>
                <span className="badge">Created</span>
              </div>
            </Link>
          ))}
        </div>

        <h3 className="muted" style={{ margin: "18px 0 8px" }}>Purchased</h3>
        <div className="course-grid">
          {data.purchased.map((c) => (
            <Link key={c._id} to={`/courses/${c._id}`} className="course-card">
              <img src={c.thumbnailUrl || "/fallback.jpg"} alt="" className="course-thumb" />
              <div className="course-title">{c.title}</div>
              <div className="course-desc">{c.description?.slice(0, 80)}</div>
              <div className="purchase-actions">
                <span className="pill">${(c.priceCents / 100).toFixed(2)}</span>
                <span className="badge badge-info">Purchased</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
