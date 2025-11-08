import axios from "axios";

/* ---- helpers: avoid sending expired/garbage tokens ---- */
function parsePayload(token) {
  try {
    const [, b64] = token.split(".");
    if (!b64) return null;
    const json = atob(b64.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch { return null; }
}
function isExpired(token) {
  const p = parsePayload(token);
  if (!p?.exp) return false;
  const now = Math.floor(Date.now() / 1000);
  return p.exp <= now + 5;
}
function getToken() {
  const raw = localStorage.getItem("token");
  if (!raw || raw === "null" || raw === "undefined") return null;
  if (isExpired(raw)) { try { localStorage.removeItem("token"); } catch {} return null; }
  return raw;
}

const api = axios.create({
  baseURL: "http://localhost:5000/api/v1",
  // withCredentials: false  // using Bearer headers, keep false
});

api.interceptors.request.use((config) => {
  const token = getToken();
  config.headers = config.headers ?? {};
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    delete config.headers.Authorization;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      // nuke bad token so subsequent PUBLIC calls don't keep failing
      try { localStorage.removeItem("token"); } catch {}
    }
    return Promise.reject(err);
  }
);

export default api;

/* ---------------------------- Course helpers ---------------------------- */
export const apiListCourses = (q = "", page = 1, limit = 20) =>
  api.get("/courses", { params: { q, page, limit } }).then(r => r.data);

export const apiCreateCourse = (payload) =>
  api.post("/courses", payload).then(r => r.data);

export const apiSetCourseThumbnail = (courseId, file) => {
  const fd = new FormData();
  fd.append("thumbnail", file);
  return api.put(`/courses/${courseId}/thumbnail`, fd).then(r => r.data);
};

export const apiCreateModule = (courseId, title) =>
  api.post(`/courses/${courseId}/modules`, { title }).then(r => r.data);

export const apiAddVideo = (courseId, mIndex, { file, title, description }) => {
  const fd = new FormData();
  fd.append("video", file);
  fd.append("title", title);
  if (description) fd.append("description", description);
  return api.post(`/courses/${courseId}/modules/${mIndex}/videos`, fd).then(r => r.data);
};

export const apiGetCourse = (id) =>
  api.get(`/courses/${id}`).then(r => r.data);

export const apiBuyCourse = (id, code) =>
  api.post(`/courses/${id}/buy`, { code }).then(r => r.data);

export const apiMyCourses = () =>
  api.get(`/my/courses`).then(r => r.data);

/* ------------------------------- Social API ------------------------------- */
// follow
export const apiFollow = (userId) => api.post(`/social/follow/${userId}`).then(r => r.data);
export const apiUnfollow = (userId) => api.delete(`/social/follow/${userId}`).then(r => r.data);
export const apiIsFollowing = (userId) => api.get(`/social/is-following/${userId}`).then(r => r.data);

// feed & posts
export const apiFeed = (page=1, limit=20) => api.get(`/social/feed`, { params: { page, limit } }).then(r => r.data);
// feed & posts
export const apiCreatePost = (payload) => {
  // Allow both legacy string and new object payloads
  if (typeof payload === "string") {
    return api.post(`/social/posts`, { text: payload }).then(r => r.data);
  }

  // New path: payload = { text, images: File[] }
  const { text = "", images = [] } = payload || {};

  // If there are files, use multipart/form-data
  if (images.length > 0) {
    const fd = new FormData();
    fd.append("text", text);
    images.forEach((file) => fd.append("images", file)); // multer.array('images')

    return api
      .post(`/social/posts`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then(r => r.data);
  }

  // Otherwise send JSON only (text post)
  return api.post(`/social/posts`, { text }).then(r => r.data);
};

export const apiPostsByUser = (userId, page=1, limit=20) => api.get(`/social/posts/user/${userId}`, { params: { page, limit } }).then(r => r.data);
export const apiReactPost = (postId) => api.post(`/social/posts/${postId}/react`).then(r => r.data);
export const apiCommentPost = (postId, text) => api.post(`/social/posts/${postId}/comment`, { text }).then(r => r.data);

// followers/following
export const apiFollowers = (userId) => api.get(`/social/followers/${userId}`).then(r => r.data);
export const apiFollowing = (userId) => api.get(`/social/following/${userId}`).then(r => r.data);

// DMs
export const apiDMConversations = () => api.get(`/social/dm`).then(r => r.data);
export const apiDMMessages = (userId, page=1, limit=50) => api.get(`/social/dm/${userId}`, { params: { page, limit } }).then(r => r.data);
export const apiSendDM = (userId, text) => api.post(`/social/dm/${userId}`, { text }).then(r => r.data);

/* ------------------------------ Public Users ------------------------------ */
export const apiGetUserPublic = (id) =>
  api.get(`/users/${id}`).then(r => r.data);

export const apiSearchUsers = (q = "", page = 1, limit = 20) =>
  api.get(`/users`, { params: { q, page, limit } }).then(r => r.data);
