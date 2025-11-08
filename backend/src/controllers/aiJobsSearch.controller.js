// backend/src/controllers/aiJobsSearch.controller.js
import Job from "../models/Job.js";

/**
 * Prompt → infer MANY likely tags/skills → return ONLY jobs that share at least one.
 * If results are thin, broaden progressively (lower threshold → regex over tags/skills → title/description regex),
 * but NEVER return “all jobs”. Anchored to prompt-derived vocabulary throughout.
 */

/* ----------------------------- utils ----------------------------- */
const s = (x) => (x == null ? "" : String(x));
const lc = (x) => s(x).toLowerCase();
const clamp = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));

const tokenize = (txt) =>
  lc(txt).replace(/[_]/g, " ").split(/[^a-z0-9+#.]+/i).filter(Boolean);

// normalize tokens for web dev variants
function normToken(t) {
  return lc(t)
    .replace(/\s+/g, " ")
    .replace(/front[-\s]?end/g, "frontend")
    .replace(/back[-\s]?end/g, "backend")
    .replace(/full[-\s]?stack/g, "fullstack")
    .replace(/e[-\s]?commerce/g, "ecommerce")
    .replace(/next\.?js/g, "nextjs")
    .replace(/node\.?js/g, "nodejs")
    .replace(/react\.?js/g, "reactjs")
    .replace(/vue\.?js/g, "vuejs")
    .replace(/nuxt\.?js/g, "nuxtjs")
    .replace(/svelte\.?kit/g, "sveltekit")
    .replace(/\./g, "")
    .trim();
}

// cheap fuzzy (subsequence + substring)
function fuzzyScore(needleRaw, hayRaw) {
  const needle = normToken(needleRaw);
  const hay = normToken(hayRaw);
  if (!needle || !hay) return 0;
  if (hay === needle) return 1;
  if (hay.includes(needle)) {
    const pos = hay.indexOf(needle);
    return clamp(0.78 + Math.max(0, 0.18 - pos / Math.max(1, hay.length)));
  }
  let i = 0, j = 0, hits = 0, streak = 0, best = 0, gaps = 0;
  while (i < needle.length && j < hay.length) {
    if (needle[i] === hay[j]) { hits++; i++; j++; streak++; best = Math.max(best, streak); }
    else { if (streak > 0) gaps++; j++; streak = 0; }
  }
  if (hits < Math.ceil(needle.length * 0.5)) return 0;
  const coverage = hits / needle.length;
  const streakBonus = best / needle.length;
  const gapPenalty = Math.min(0.5, gaps / (needle.length + 2));
  return clamp(0.5 * coverage + 0.4 * streakBonus + 0.1 * (1 - gapPenalty));
}

// synonym bank: expand vague prompts like “website” → many web tags/skills
const SYNONYMS = {
  website: ["website","web","webdev","web-development","frontend","fullstack","javascript","react","reactjs","nextjs","nodejs","express","html","css","tailwind","bootstrap","seo","wordpress","shopify","ecommerce"],
  web: ["web","website","webdev","frontend","fullstack","javascript","react","nextjs","nodejs","express","html","css"],
  ecommerce: ["ecommerce","shopify","woocommerce","stripe","paypal","sslcommerz","checkout","cart","product-page","seo","nextjs","react"],
  landing: ["landing","landing-page","website","seo","nextjs","react","tailwind","framer"],
  seo: ["seo","meta","schema","performance","lighthouse"],
  react: ["react","reactjs","nextjs","typescript","redux","router","tailwind"],
  nextjs: ["nextjs","react","reactjs","app-router","ssr","ssg","isr","seo","tailwind"],
  wordpress: ["wordpress","elementor","woocommerce","php","theme","plugin"],
  fullstack: ["fullstack","frontend","backend","nodejs","express","mongodb","postgres"],
  "front end": ["frontend","react","vue","svelte","nextjs","tailwind"],
  "back end": ["backend","nodejs","express","mongodb","postgres","prisma"],
};

function expandWithSynonyms(tokens) {
  const out = new Set(tokens);
  for (const t of tokens) {
    const key = normToken(t);
    (SYNONYMS[key] || SYNONYMS[t] || []).forEach((syn) => out.add(normToken(syn)));
  }
  return Array.from(out);
}

function escRe(x) { return x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

/* --------------------------- controller --------------------------- */
export async function aiFindJobs(req, res) {
  try {
    const {
      prompt = "",
      minBudget = 0,
      limit = 60,
      status = "open",     // default: fetch only open jobs
      maxTags = 30,
    } = req.body || {};

    const cleanPrompt = s(prompt).trim();
    if (!cleanPrompt) {
      return res.json({ tags: [], matches: [], info: { reason: "empty prompt" } });
    }

    // A) prompt → tokens (+ ngrams) → synonyms
    const baseTokens = tokenize(cleanPrompt).map(normToken);
    const ngrams = [];
    for (let n = 2; n <= 3; n++) {
      for (let i = 0; i + n <= baseTokens.length; i++) {
        ngrams.push(normToken(baseTokens.slice(i, i + n).join(" ")));
      }
    }
    const expandedTokens = expandWithSynonyms([...baseTokens, ...ngrams]);

    // B) build vocab from DB: tags + requiredSkills (your schema fields)
    const vocabAgg = await Job.aggregate([
      { $match: status ? { status } : {} }, // only “open” by default
      {
        $project: {
          items: {
            $setUnion: [
              { $ifNull: ["$tags", []] },
              { $ifNull: ["$requiredSkills", []] },
            ]
          }
        }
      },
      { $unwind: "$items" },
      { $group: { _id: { $toLower: "$items" }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 2000 },
    ]);

    const vocab = vocabAgg.map((x) => normToken(x._id)).filter(Boolean);
    if (!vocab.length) {
      return res.json({ tags: [], matches: [], info: { reason: "no tags/skills in dataset" } });
    }

    // C) score vocab vs expanded tokens
    const scored = vocab.map((cand) => {
      const bestTok = Math.max(...expandedTokens.map((tok) => fuzzyScore(tok, cand)));
      const direct = ngrams.some((ng) => cand.includes(ng)) ? 0.2 : 0;
      return { cand, score: clamp(bestTok + direct, 0, 1) };
    }).sort((a, b) => b.score - a.score);

    // D) tiered inferred set (broader if needed)
    let inferred = scored.filter((x) => x.score >= 0.55).slice(0, maxTags).map((x) => x.cand);
    if (inferred.length < 12) {
      inferred = scored.filter((x) => x.score >= 0.45).slice(0, Math.max(maxTags, 40)).map((x) => x.cand);
    }
    if (inferred.length < 12) {
      inferred = scored.slice(0, Math.max(maxTags, 50)).map((x) => x.cand);
    }

    // E) RUN #1 — strict intersection on tags/requiredSkills
    const minB = Number(minBudget) || 0;
    const baseQuery = {
      $and: [
        status ? { status } : {},
        minB ? { budget: { $gte: minB } } : {},
        { $or: [{ tags: { $in: inferred } }, { requiredSkills: { $in: inferred } }] },
      ].filter(Boolean),
    };

    let results = await Job.find(baseQuery)
      .select("title description tags requiredSkills budget createdAt status")
      .sort({ createdAt: -1 })
      .limit(Math.max(200, Number(limit) || 60))
      .lean();

    const want = Math.min(100, Math.max(30, Number(limit) || 60));

    // F) RUN #2 — if thin, regex match tags/skills using expanded tokens
    if (results.length < want) {
      const regexParts = Array.from(new Set(
        expandedTokens.filter(Boolean).map(escRe).slice(0, 20)
      ));
      if (regexParts.length) {
        const re = new RegExp(`(${regexParts.join("|")})`, "i");
        const more = await Job.find({
          $and: [
            status ? { status } : {},
            minB ? { budget: { $gte: minB } } : {},
            {
              $or: [
                { tags: { $elemMatch: { $regex: re } } },
                { requiredSkills: { $elemMatch: { $regex: re } } },
              ]
            }
          ].filter(Boolean)
        })
          .select("title description tags requiredSkills budget createdAt status")
          .sort({ createdAt: -1 })
          .limit(300)
          .lean();

        const ids = new Set(results.map(r => String(r._id)));
        for (const m of more) {
          if (!ids.has(String(m._id))) results.push(m);
          if (results.length >= want) break;
        }
      }
    }

    // G) RUN #3 — if still thin, title/description regex (still anchored by inferred overlap)
    if (results.length < want) {
      const tops = Array.from(new Set(
        expandedTokens.filter(t => t.length >= 3).slice(0, 10)
      ));
      if (tops.length) {
        const re = new RegExp(`(${tops.map(escRe).join("|")})`, "i");
        const more = await Job.find({
          $and: [
            status ? { status } : {},
            minB ? { budget: { $gte: minB } } : {},
            { $or: [{ title: re }, { description: re }] },
          ].filter(Boolean)
        })
          .select("title description tags requiredSkills budget createdAt status")
          .sort({ createdAt: -1 })
          .limit(300)
          .lean();

        const ids = new Set(results.map(r => String(r._id)));
        for (const m of more) {
          // still require weak overlap with inferred set to avoid "show all"
          const bag = [...(m.tags || []), ...(m.requiredSkills || [])].map(normToken);
          if (bag.some(x => inferred.includes(x))) {
            if (!ids.has(String(m._id))) results.push(m);
          }
          if (results.length >= want) break;
        }
      }
    }

    // H) final sort + trim
    results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const out = results.slice(0, Number(limit) || 60);

    return res.json({
      tags: inferred,   // inferred tag/skill set used for filtering
      matches: out,     // only jobs intersecting those tags/skills
      info: {
        returned: out.length,
        inferredCount: inferred.length,
        widened: results.length > out.length || results.length >= want,
        statusFilter: status || null,
        minBudgetApplied: !!minB,
      },
    });
  } catch (err) {
    console.error("aiFindJobs error:", err);
    res.status(500).json({ error: "Failed to run AI search", detail: err.message });
  }
}
