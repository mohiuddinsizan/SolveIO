import { ALLOWED_SKILLS, ALLOWED_TAGS } from "../constants/meta.js";

export const getMeta = (_req, res) => {
  res.json({
    skills: ALLOWED_SKILLS,
    tags: ALLOWED_TAGS
  });
};
