// backend/src/controllers/aiSkillDev.controller.js
import Job from "../models/Job.js";
import User from "../models/User.js";
import Course from "../models/Course.js";

/* ------------------------------ helpers ------------------------------ */

const STOP = new Set([
  "the","a","an","for","and","or","to","of","in","on","by","with","at","from","as",
  "this","that","these","those","it","its","is","are","be","was","were","i","we","you",
  "they","he","she","them","him","her","our","your","their","my","me","us",
  "good","great","nice","bad","poor","better","best","very","more","most","less","least",
  "need","needs","needed","should","must","could","would","can","cannot","cant","won't",
  "please","thanks","thank","hey","hi","hello","ok","okay",
  "deliver","delivery","deliverable","work","task","project","job","jobs","done","doing","did",
  "issue","issues","bug","bugs","fix","fixed","fixes",
  "time","timely","deadline","late","delay","delayed",
  "quality","review","feedback","comment","comments","note","notes"
]);

function tokenizeSkills(text) {
  return String(text || "")
    .toLowerCase()
    .split(/[^a-z0-9+#.\-]+/g)
    .map(s => s.trim())
    .filter(s => s && !STOP.has(s) && s.length > 1)
    .slice(0, 10);
}

function uniqueLower(list, limit = 50) {
  const out = [];
  const seen = new Set();
  for (const v of list || []) {
    const s = String(v || "").toLowerCase().trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= limit) break;
  }
  return out;
}

function escRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* ------------------------------ controller ------------------------------ */

export async function aiSkillDevelopment(req, res) {
  try {
    const workerId = req.user?.sub;
    if (!workerId) return res.status(401).json({ error: "Not authenticated" });

    const me = await User.findById(workerId).lean();
    if (!me) return res.status(404).json({ error: "User not found" });

    // Completed jobs this freelancer did
    const completed = await Job.find({
      assignedTo: workerId,
      status: "completed",
    })
      .select("title tags requiredSkills employerReview freelancerReview createdAt updatedAt employerId acceptedPrice budget")
      .populate({ path: "employerId", select: "name" })
      .sort({ updatedAt: 1 })
      .lean();

    // Employers' ratings to me (received)
    const ratingsReceived = completed
      .filter(j => j.employerReview?.rating)
      .map(j => ({
        at: j.updatedAt || j.createdAt,
        rating: j.employerReview.rating,
        comment: j.employerReview.comment || "",
        jobTitle: j.title,
        employerName: j.employerId?.name || "Employer",
      }));

    // My ratings to employers (given)
    const ratingsGiven = completed
      .filter(j => j.freelancerReview?.rating)
      .map(j => ({
        at: j.updatedAt || j.createdAt,
        rating: j.freelancerReview.rating,
        comment: j.freelancerReview.comment || "",
        jobTitle: j.title,
        employerName: j.employerId?.name || "Employer",
      }));

    const avgReceived =
      ratingsReceived.length
        ? Number((ratingsReceived.reduce((s, r) => s + r.rating, 0) / ratingsReceived.length).toFixed(2))
        : 0;

    const last3 = ratingsReceived.slice(-3);
    const recentAvg = last3.length ? Number((last3.reduce((s, r) => s + r.rating, 0) / last3.length).toFixed(2)) : 0;

    // collect employer feedback (received)
    const feedback = completed
      .filter(j => j.employerReview?.comment)
      .map(j => ({
        jobTitle: j.title,
        employer: j.employerId?.name || "Employer",
        comment: j.employerReview.comment,
        rating: j.employerReview.rating || null,
        at: j.updatedAt || j.createdAt,
      }));

    // ---- Market demand from open jobs (tags + requiredSkills) ----
    const openJobs = await Job.find({ status: "open" })
      .select("tags requiredSkills")
      .limit(500)
      .lean();

    const demandMap = new Map();
    for (const j of openJobs) {
      for (const t of (j.tags || [])) {
        const k = String(t).toLowerCase().trim();
        if (!k) continue;
        demandMap.set(k, (demandMap.get(k) || 0) + 1);
      }
      for (const s of (j.requiredSkills || [])) {
        const k = String(s).toLowerCase().trim();
        if (!k) continue;
        demandMap.set(k, (demandMap.get(k) || 0) + 1);
      }
    }
    const demand = Array.from(demandMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    // ---- LACKS: what the market wants that the freelancer doesn't list ----
    const mySkills = uniqueLower(me.skills || []);
    const demandTerms = demand.map(d => d.name);
    const lacking = demandTerms.filter(t => !mySkills.includes(t)).slice(0, 12);

    // ---- Pull skill-like tokens from employer feedback (when low-ish rating) ----
    const feedbackTokens = [];
    for (const f of feedback) {
      // prioritize comments accompanying < 4-star ratings
      if ((f.rating ?? 5) < 4) {
        feedbackTokens.push(...tokenizeSkills(f.comment));
      }
    }

    // Primary keyword set to search courses with
    const keywords = uniqueLower([
      ...lacking,                 // gaps first
      ...demandTerms.slice(0, 12),// top market demand
      ...feedbackTokens.slice(0, 12), // pain points from feedback
    ], 30);

    // If we somehow have nothing, seed with my skills (so we still show something)
    const effectiveKeywords = keywords.length ? keywords : uniqueLower(mySkills, 10);

    // -------- Course search stages (increasingly broader) --------
    const mkRegexes = (terms) => terms.map(t => new RegExp(escRe(t), "i"));

    // Stage 1: title/description/tags match any *effective* keyword
    const re1 = mkRegexes(effectiveKeywords);
    let courseQuery = {
      $or: [
        { title:       { $in: re1 } },
        { description: { $in: re1 } },
        { tags:        { $in: effectiveKeywords } },
      ],
      isPublished: { $ne: false },
    };
    let courses = await Course.find(courseQuery)
      .select("title description thumbnailUrl priceCents tags createdAt")
      .sort({ createdAt: -1 })
      .limit(40)
      .lean();

    // Stage 2: broaden to demand-only if too few
    if (courses.length < 6 && demandTerms.length) {
      const re2 = mkRegexes(demandTerms);
      courseQuery = {
        $or: [
          { title:       { $in: re2 } },
          { description: { $in: re2 } },
          { tags:        { $in: demandTerms } },
        ],
        isPublished: { $ne: false },
      };
      const more = await Course.find(courseQuery)
        .select("title description thumbnailUrl priceCents tags createdAt")
        .sort({ createdAt: -1 })
        .limit(40)
        .lean();
      // merge without dupes
      const seen = new Set(courses.map(c => String(c._id)));
      for (const m of more) if (!seen.has(String(m._id))) courses.push(m);
    }

    // Stage 3: fallback — just show latest published so the UI never looks empty
    if (courses.length === 0) {
      courses = await Course.find({ isPublished: { $ne: false } })
        .select("title description thumbnailUrl priceCents tags createdAt")
        .sort({ createdAt: -1 })
        .limit(12)
        .lean();
    }

    // -------- Local ranking by keyword match count (explainable) --------
    const keySet = new Set(effectiveKeywords);
    function matchedTermsForCourse(c) {
      const bag = new Set();
      const hay = [
        String(c.title || "").toLowerCase(),
        String(c.description || "").toLowerCase(),
        ...(Array.isArray(c.tags) ? c.tags.map(t => String(t).toLowerCase()) : []),
      ].join(" ");
      for (const k of keySet) {
        if (!k) continue;
        if (hay.includes(k)) bag.add(k);
      }
      return Array.from(bag);
    }

    const ranked = courses
      .map(c => {
        const matched = matchedTermsForCourse(c);
        return { ...c, _score: matched.length, matched };
      })
      .sort((a, b) => {
        if (b._score !== a._score) return b._score - a._score;
        return (b.createdAt?.getTime?.() || 0) - (a.createdAt?.getTime?.() || 0);
      })
      .slice(0, 12);

    return res.json({
      user: {
        _id: me._id,
        name: me.name,
        email: me.email,
        ratingAvg: me.ratingAvg || 0,
        ratingCount: me.ratingCount || 0,
        skills: mySkills,
      },
      summary: {
        completedCount: completed.length,
        avgRatingReceived: avgReceived,
        recentAvgReceived: recentAvg,
      },
      ratings: {
        received: ratingsReceived,   // employer → freelancer
        given: ratingsGiven,         // freelancer → employer
      },
      feedback,                      // employer comments to freelancer
      demand,                        // in-demand tokens
      lacking,                       // market-demanded but missing on profile
      courseSuggestions: ranked.map(c => ({
        _id: c._id,
        title: c.title,
        description: c.description,
        thumbnailUrl: c.thumbnailUrl,
        priceCents: c.priceCents,
        tags: c.tags || [],
        createdAt: c.createdAt,
        matched: c.matched,          // <-- reasons (keywords that matched)
        score: c._score,
      })),
    });
  } catch (e) {
    console.error("aiSkillDevelopment error:", e);
    return res.status(500).json({ error: e?.message || "Internal Server Error" });
  }
}
