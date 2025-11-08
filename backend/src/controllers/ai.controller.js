// backend/src/controllers/ai.controller.js
import fetch from "node-fetch";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-2.0-flash-001";

function ensureEnv() {
  if (!GEMINI_API_KEY) {
    const err = new Error("Server misconfigured: missing GEMINI_API_KEY");
    err.status = 500;
    throw err;
  }
}

async function gemini(textParts = []) {
  ensureEnv();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(
    GEMINI_API_KEY
  )}`;

  const body = {
    contents: textParts.map((t) => ({ role: "user", parts: [{ text: t }]})),
    generationConfig: { temperature: 0.7 },
  };

  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    const err = new Error(`Gemini error ${r.status}: ${txt || r.statusText}`);
    err.status = 502;
    throw err;
  }

  const data = await r.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const reply =
    parts.find((p) => typeof p.text === "string")?.text ||
    parts.map((p) => p.text).filter(Boolean).join("\n") ||
    "";
  return reply.trim();
}

function stripCodeFence(text = "") {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

function extractJsonFromText(text = "") {
  const fence = text.match(/```json\s*([\s\S]*?)\s*```/i);
  const raw = fence ? fence[1] : (text.match(/\{[\s\S]*\}$/) || [])[0];
  if (!raw) return null;
  try { return JSON.parse(stripCodeFence(raw)); } catch { return null; }
}

function normalizeJob(obj = {}, prompt = "") {
  const safe = (v, d) => (v === undefined || v === null ? d : v);

  const title = safe(obj.title, "Full E-commerce Website Design");
  const description = safe(
    obj.description,
    `Design a modern, conversion-focused website.\n\nClient brief: ${prompt}`
  );

  const requiredSkills = Array.isArray(obj.requiredSkills) && obj.requiredSkills.length
    ? obj.requiredSkills.map(String)
    : ["html", "css", "javascript", "responsive design"];

  const tags = Array.isArray(obj.tags) && obj.tags.length
    ? obj.tags.map(String)
    : ["website", "web-development"];

  let budget = Number.isFinite(obj.budget) ? Number(obj.budget) : 500;
  const budgetType =
    obj.budgetType === "hourly" || obj.budgetType === "fixed"
      ? obj.budgetType
      : "fixed";

  const experienceLevel = ["entry", "intermediate", "expert"].includes(obj.experienceLevel)
    ? obj.experienceLevel
    : "intermediate";

  const deadline = typeof obj.deadline === "string" ? obj.deadline : "";

  if (experienceLevel === "entry" && budgetType === "fixed" && budget < 100) budget = 150;
  if (experienceLevel === "expert" && budgetType === "fixed" && budget < 1000) budget = 1200;

  return { title, description, requiredSkills, tags, budget, budgetType, experienceLevel, deadline };
}

export async function aiChat(req, res) {
  try {
    const { message, context } = req.body || {};
    const sys = `
You are an assistant helping users craft job posts for a Fiverr-like site.
- Reply conversationally.
- If appropriate, include an OPTIONAL JSON patch in a \`\`\`json code block\`\`\` that can update these fields:
  title, description, requiredSkills (array), tags (array), budget (number), budgetType ("fixed"|"hourly"), experienceLevel ("entry"|"intermediate"|"expert"), deadline (YYYY-MM-DD or "").
- Keep patch minimal & realistic. Do not explain the JSON block.`;

    const ctx = `Current form values:\n${JSON.stringify(context || {}, null, 2)}`;
    const user = String(message || "").trim();

    const reply = await gemini([sys, ctx, user]);
    res.json({ reply });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || "AI chat error" });
  }
}

export async function aiGenerateJob(req, res) {
  try {
    const { prompt } = req.body || {};
    const instruction = `
Generate a complete job post for a marketplace. 
Return either:
1) ONLY a JSON object with fields: title, description, requiredSkills (array), tags (array), budget (number), budgetType ("fixed"|"hourly"), experienceLevel ("entry"|"intermediate"|"expert"), deadline (YYYY-MM-DD or "").
OR
2) Freeform text plus a \`\`\`json code block\`\`\` containing that object.
Avoid extreme budgets.`;

    const reply = await gemini([instruction, String(prompt || "")]);

    let parsed = null;
    try { parsed = JSON.parse(stripCodeFence(reply)); } catch { parsed = extractJsonFromText(reply); }

    const job = normalizeJob(parsed || {}, prompt || "");
    res.json({ job, raw: reply });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || "AI generate error" });
  }
}
