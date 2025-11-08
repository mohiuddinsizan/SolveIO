// src/pages/Jobs.jsx
import { useEffect, useState } from "react";
import api from "../lib/api";

export default function Jobs() {
  const [jobs, setJobs] = useState([]);

  useEffect(() => {
    (async () => {
      const r = await api.get("/jobs");
      setJobs(r.data || []);
    })();
  }, []);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold mb-4">Open Jobs</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {jobs.map((j) => (
          <div key={j._id} className="border rounded p-4">
            <div className="font-semibold">{j.title}</div>
            <div className="text-sm text-gray-600 mb-2">{j.description}</div>

            <div className="text-sm">Budget: ${j.budget}</div>

            {/* NEW: Poster + rating */}
            <div className="text-sm mt-1">
              Posted by{" "}
              <span className="font-medium">
                {j.employer?.name || j.employerName || "Employer"}
              </span>
              {(j.employer?.ratingAvg ?? j.employerRatingAvg) != null && (
                <>
                  {" "}• ⭐ {(j.employer?.ratingAvg ?? j.employerRatingAvg).toFixed(1)}
                  {typeof (j.employer?.ratingCount ?? j.employerRatingCount) === "number" &&
                    ` (${j.employer?.ratingCount ?? j.employerRatingCount})`}
                </>
              )}
            </div>

            <div className="text-xs text-gray-500">
              Skills: {j.requiredSkills?.join(", ")}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
