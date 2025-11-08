⚙️ Quick Start
1. Install
npm install

2. Configure .env
MONGODB_URI=mongodb://localhost:27017/syncpmo
PORT=4000

JWT_SECRET=replace_me
JWT_EXPIRES_IN=7d

ADMIN_USERNAME=admin
ADMIN_PASSWORD=supersecret

GEMINI_API_KEY=your_gemini_api_key

CLOUDINARY_CLOUD_NAME=your_name
CLOUDINARY_API_KEY=your_key
CLOUDINARY_API_SECRET=your_secret
CLOUDINARY_FOLDER=solveio/courses

3. Run
node backend/src/app.js

👥 Auth & Roles
Role	Description
admin	Env-only login (no DB record)
employer	Posts jobs, funds escrow
worker	Applies to jobs, earns, creates courses

Middleware:

requireAuth

requireRole("employer" | "worker" | "admin")

🧭 Health & Meta
Method	Path	Auth	Description
GET	/ping	—	Health check { pong: true }.
GET	/meta	—	Allowed skills and tags.
🔐 Auth
Method	Path	Body	Notes
POST	/auth/register	{ email, name, password, role }	Creates worker/employer, blocks admin creation.
POST	/auth/login	`{ identifier	username
GET	/me	—	Returns { user: { id, role } }.
Profile & Skills
Method	Path	Role	Description
GET	/me/profile	any	Returns wallet & stats.
PUT	/me/skills	worker	Update worker skills.
👤 Users
Method	Path	Auth	Description
GET	/users/:id	✓	Public profile { name, email, role }.
GET	/users	✓	Search ?q=&page=&limit=.
💼 Jobs

Public

Method	Path	Description
GET	/jobs	List jobs
GET	/jobs/:id	Job details

Protected

Method	Path	Role	Description
POST	/jobs	employer	Create job (multipart attachments).
POST	/jobs/:id/apply	worker	Apply for job.
GET	/jobs/:id/applicants	employer	List applicants.
POST	/jobs/:id/assign	employer	Assign worker.
POST	/jobs/:id/submit	worker	Submit work.
POST	/jobs/:id/approve	employer	Approve and release escrow.
POST	/jobs/:id/rate	any	Rate job.
💰 Escrow / Wallets / Tips
Method	Path	Role	Description
GET	/jobs/:id/escrow	any	Get escrow info.
POST	/jobs/:id/escrow/fund	employer	Fund escrow (company wallet).
POST	/jobs/:id/tip	employer	Tip freelancer.

Internal: releaseEscrow(jobId) → transfers funds (5% fee).

💬 Chat
Method	Path	Description
GET	/jobs/:id/messages	Job messages (only assigned parties).
POST	/jobs/:id/messages	Send message.
📦 Orders
Method	Path	Role	Description
GET	/orders/employer	employer	{ requested, inProgress, completed }.
GET	/orders/freelancer	worker	{ requested, inProgress, completed, rejected }.
📊 Stats
Method	Path	Role	Returns
GET	/stats/admin	admin	Global profit, escrow holdings, job counts, monthly profit.
GET	/stats/employer	employer	Employer job summary.
GET	/stats/freelancer	worker	Job stats, payouts, cumulative earnings.
🤖 AI Endpoints
Path	Role	Description
/ai/chat	any	Chat assistant for job descriptions.
/ai/generate	employer	Generates complete job posts.
/ai/find-jobs	public	Semantic AI-powered job search.
/ai/skill-development	worker	Skill and course recommendations.

Gemini Model: gemini-2.0-flash-001

🎓 Courses
Method	Path	Role	Description
GET	/courses	—	Public list.
GET	/courses/:id	any	Course details (locked for non-buyers).
GET	/my/courses	any	Created and purchased courses.
POST	/courses	worker	Create minimal course.
PUT	/courses/:id/thumbnail	worker	Upload thumbnail.
POST	/courses/:id/modules	worker	Add module.
POST	/courses/:id/modules/:mIndex/videos	worker	Add video.
POST	/courses/full	worker	Unified creation with metadata.
POST	/courses/:id/buy	any	Buy course (code "syncpmo").
🌐 Social
Follow
Method	Path	Description
POST	/social/follow/:userId	Follow user.
DELETE	/social/follow/:userId	Unfollow.
GET	/social/followers/:userId	Followers list.
GET	/social/following/:userId	Following list.
GET	/social/is-following/:userId	Check following.
Posts
Method	Path	Description
POST	/social/posts	Create post with optional images.
GET	/social/feed	User + following feed.
GET	/social/posts/user/:userId	Posts by user.
POST	/social/posts/:id/react	Toggle like.
POST	/social/posts/:id/comment	Add comment.
DMs
Method	Path	Description
GET	/social/dm	List conversations.
GET	/social/dm/:userId	Messages with peer.
POST	/social/dm/:userId	Send DM.
🧩 Uploads

upload.array("attachments", 5) — job attachments

uploadVideo.single("video") — course video

uploadMixedCourseFull.any() — unified course creation

Optional controllers:

/upload/thumb → Cloudinary image

/upload/video → Cloudinary video

🧠 Security Highlights

Admin creation blocked via API.

Chat limited to assigned parties only.

Escrow release uses transactions.

Courses hide locked content for unauthorized users.

Social actions validated via ObjectId.

⚠️ Error Shape
{ "error": "Message", "detail": "Optional detail" }


Common codes: 400, 401, 403, 404, 500.

🗂 Environment Summary
Variable	Purpose
MONGODB_URI	MongoDB connection
PORT	Server port
JWT_SECRET / JWT_EXPIRES_IN	Auth config
ADMIN_USERNAME / ADMIN_PASSWORD	Admin login
GEMINI_API_KEY	Google Generative Language API
CLOUDINARY_*	Cloudinary credentials
🧪 Examples

Login

POST /auth/login
{ "identifier": "admin", "password": "supersecret" }


AI Generate

POST /ai/generate
{ "prompt": "Build a modern e-commerce site" }


Find Jobs

POST /ai/find-jobs
{ "prompt": "nextjs ecommerce landing", "minBudget": 200 }

🧾 License

MIT (or your preferred).
