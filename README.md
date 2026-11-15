# LearnLoop

An independent learning platform for turning video playlists into structured
courses. This repository is organized as an npm-workspaces monorepo.

## Architecture

- `client/` — React, Vite, and Tailwind CSS user interface.
- `server/` — Express REST API, MongoDB persistence, and authentication.
- `ai-engine/` — reserved for a separately deployed Python service if later
  features justify one; no Python service is required for the initial setup.

The browser uses the Vite development proxy to access the Express API at
`/api`. In production, the client can use `VITE_API_BASE_URL` to target the
deployed API.

## Requirements

- Node.js 20.19+ or 22.12+
- npm 10+
- MongoDB locally or a MongoDB Atlas connection string

## Setup

1. Copy `.env.example` to `server/.env` for local server development.
2. Set `JWT_SECRET` to a random value of at least 32 characters. Generate one
   with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
3. Set `MONGODB_URI` to your local MongoDB or Atlas database.
4. For a deployed client that uses a non-proxied API URL, set
   `VITE_API_BASE_URL` in `client/.env`; never put secrets in client variables.
5. Install dependencies from the repository root with `npm install`.
6. Start both applications with `npm run dev`.
7. Open the Vite URL shown in the terminal (normally `http://localhost:5173`).
8. Verify the API at `http://localhost:5000/api/health`.

Individual commands: `npm run dev:client`, `npm run dev:server`, and
`npm run build`.

## API

- `GET /api/health` reports API and MongoDB readiness.
- `POST /api/auth/register`, `POST /api/auth/login`, and
  `POST /api/auth/logout` manage an HttpOnly session cookie.
- `GET /api/auth/me` returns the authenticated user.
- `GET /api/users/me` and `PATCH /api/users/me` read and update the profile.
- `POST /api/playlists/import` validates and imports a public YouTube playlist
  into the authenticated user's course library.
- `GET /api/courses` and `GET /api/courses/:courseId` list and read owned courses.
- `GET /api/courses/:courseId/learning-state` reads lesson completion, notes,
  and bookmarks for the signed-in learner.
- `PUT /api/courses/:courseId/videos/:videoId/learning-state` updates a lesson's
  completion status, personal note, and/or bookmark.
- `POST /api/ai/courses/:courseId/structure` generates and saves a validated
  course outline for an owned playlist import.
- `GET` and `POST /api/study-plans/courses/:courseId` read or generate an
  owner-scoped study plan.
- `PATCH /api/study-plans/:planId/sessions/:sessionId` updates a session's
  date, duration, focus, lesson selection, or completion.
- `GET` and `POST /api/quizzes/courses/:courseId` list or generate quizzes and
  placement tests for an owned course.
- `GET /api/quizzes/:quizId` returns questions without answer keys;
  `POST /api/quizzes/:quizId/attempts` scores and saves a completed attempt.
- `GET /api/progress` returns course completion, activity streaks, recent
  activity, weekly study time, and quiz scores.
- `POST /api/progress/study-sessions` records a timed study session for an
  owned course.
- `GET /api/chat/courses/:courseId` lists tutor conversation summaries;
  `GET /api/chat/conversations/:conversationId` reads an owned conversation.
- `POST /api/chat/courses/:courseId/messages` sends a contextual tutor question
  and creates or continues a conversation.
- `GET` and `PUT /api/courses/:courseId/videos/:videoId/transcript` retrieve
  transcript availability and save user-provided transcript text.

Playlist import uses the server-only `YOUTUBE_API_KEY`, imports at most 500
videos, and reports quota or upstream errors explicitly. Playlist metadata is
embedded in its course document so the import is stored as one MongoDB write.
YouTube Data API responses do not include transcripts; no automatic transcript
source is assumed. User-provided transcripts are stored separately from course
documents so long text cannot inflate an imported course document.

AI course generation uses the server-only `GEMINI_API_KEY` and configurable
`GEMINI_MODEL` (defaults to `gemini-2.5-flash`). The generated outline is
validated before the course is updated; it must place every imported video
exactly once and in playlist order. Generation is limited to three requests per
15 minutes per client IP. Without a Gemini key, the endpoint responds with an
explicit configuration error.

The course player embeds YouTube's privacy-enhanced player, supports previous
and next lesson navigation, and saves completion, notes, and bookmarks in
user-scoped lesson state. Lesson state is stored separately from course data
and is only readable or writable by the course owner.

The study planner requires a structured course. It validates that the schedule
covers every lesson in order, uses only selected study days, stays within the
requested time window, and includes revision before saving. Existing plans are
edited per session rather than silently replaced.

Quizzes and placement tests also require a structured course. Generation uses
course outlines and any user-provided transcripts available to the course.
Generated question topics and lesson references are validated before saving,
and answer keys are never returned until an attempt is submitted. Multiple
choice and true/false answers are scored exactly; short answers use normalized
exact matching against the expected answer and accepted alternatives. Placement
results provide per-chapter mastery estimates and learning recommendations;
these are guidance from a small generated question sample, not a formal
assessment.

The dashboard derives lesson progress from completed lessons, quiz history
from saved attempts, and streaks from lesson completion, quiz submissions, or
logged study sessions. Study time is recorded only when the learner uses and
saves the course-player timer; it is not inferred from YouTube playback.

The AI tutor uses the course outline, user-provided transcripts, and private
lesson notes for context. Transcript and note context sent to the configured
Gemini provider is capped per request; conversation history is owner-scoped and
bounded. Tutor citations link to course lessons, not timestamp-verified quotes.
Only the selected course owner's materials and conversations are included.

Authentication cookies are HttpOnly, use `COOKIE_SAME_SITE` (Lax by default),
are scoped to `/api`, and are marked Secure in production. Mutating browser
requests must match `CLIENT_ORIGIN`.
For separate cross-site production domains, set `COOKIE_SAME_SITE=none` and
serve over HTTPS; the origin check remains enabled. The development client
reaches the API through Vite's same-origin proxy.

Run API tests with `npm test`; build the client with `npm run build`.

## Deployment

The repository includes Dockerfiles, an Nginx SPA/API proxy, a Compose stack,
and a GitHub Actions workflow that runs the server tests and production build
on supported Node versions.

For the Compose deployment:

1. Configure a root `.env` with `CLIENT_ORIGIN=https://your-domain.example`,
   a cryptographically random `JWT_SECRET` of at least 32 characters, and
   optionally `YOUTUBE_API_KEY`, `GEMINI_API_KEY`, and `GEMINI_MODEL`.
2. Set `MONGODB_URI` to a secured MongoDB deployment for production. The
   Compose-provided Mongo service is a convenient single-host option with a
   private container network and persistent volume; it is not a substitute for
   managed database authentication, TLS, backups, and monitoring.
3. Put the web service on port 8080 behind a TLS-terminating reverse proxy.
   The public origin must match `CLIENT_ORIGIN`. Set `TRUST_PROXY` to the exact
   number of trusted proxy hops seen by Express, and configure those proxies to
   overwrite untrusted forwarded headers.
4. Run `docker compose up --build -d`, then verify `docker compose ps` and
   `https://your-domain.example/api/health`.

The Compose stack uses Secure cookies and requires an HTTPS public origin.
Local development over HTTP should use `npm run dev`. Keep `.env`, provider
keys, database credentials, and JWT secrets out of source control and client
build variables. Back up MongoDB data and rotate credentials using the chosen
hosting provider's secret-management facilities.

### Deploy on Railway

Railway runs this monorepo as two services built from the same GitHub
repository, plus MongoDB from Railway's database template.

1. Push the repository to GitHub and create a Railway project.
2. Add the database: **New → Database → MongoDB**. It is reachable on port
   27017 over the project's private network.
3. Add the API service from your repository. In **Settings** keep **Root
   Directory** at `/`, set **Build → Dockerfile path** to `server/Dockerfile`,
   leave **Railway Config File** empty, and set the healthcheck path to
   `/api/health`. Variables:

   | Variable | Value |
   | --- | --- |
   | `MONGODB_URI` | `${{Mongo.MONGO_URL}}` |
   | `JWT_SECRET` | 32+ random characters |
   | `PORT` | `5000` |
   | `CLIENT_ORIGIN` | `https://<web public domain>` |
   | `COOKIE_SAME_SITE` | `lax` |
   | `TRUST_PROXY` | `1` |
   | `YOUTUBE_API_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL` | as needed |

4. Add the web service from the same repository, again with **Root Directory**
   `/` and **Dockerfile path** `client/Dockerfile`, healthcheck `/`. Set one
   variable, `API_UPSTREAM`, to `${{api.RAILWAY_PRIVATE_DOMAIN}}:5000`, then
   generate a public domain under **Networking**.
5. Deploy the API before the web service.

The web container proxies `/api` to the API over the private network, so the
browser talks to a single origin: leave `VITE_API_BASE_URL` unset and keep
`COOKIE_SAME_SITE=lax`. Both Dockerfiles build from the repository root because
the npm workspaces share one lockfile, which is why every service keeps the
repository root as its root directory and only the Dockerfile path differs.
Railway deprecated the per-service `railway.json` / `railway.toml` config files
(no new opt-ins since 2026-08-28, unread after 2026-12-01), so these settings
live in the dashboard; project-level configuration can move to
`.railway/railway.ts` later with `railway config init` and `railway config pull`.

Nginx resolves its upstream when it starts, so the web service only comes up
once the API service exists and resolves; the configured restart policy covers
the gap during a first deploy. Transcripts, notes, and generated content stay in
MongoDB, so use a Railway volume or a managed MongoDB with backups.

### Verify a deployment

Check a live deployment from the terminal with the bundled script (no
dependencies beyond Node):

```bash
node scripts/check-deploy.mjs https://your-app.up.railway.app
node scripts/check-deploy.mjs https://your-app.up.railway.app --api https://api.up.railway.app
```

It checks that the web root serves the app shell, that `/dashboard` falls back to
`index.html`, that `/api/health` answers `status: ok` with the database
connected, and that the auth route responds. It prints a PASS/FAIL line per
check and exits non-zero when anything fails, so it can gate a deploy. The same
script works against local development: `npm run check:deploy --
http://localhost:5173 --api http://localhost:5000`.

### Railway troubleshooting

- **Web service restarts with `host not found in upstream`** — the API service
  does not exist yet or `API_UPSTREAM` names the wrong service; deploy the API
  first and match its service name exactly.
- **`/api/health` returns 502 through the web domain** — the API is down or
  still starting; check its logs for `LearnLoop API listening`.
- **API exits with `Invalid environment configuration`** — a required variable
  is missing, usually `JWT_SECRET` or `MONGODB_URI`.
- **`CLIENT_ORIGIN: is not set` / `must use HTTPS in production` and the API
  crash-loops** — the value is still the local default or lacks a scheme. Set it
  to the web service's public URL (`https://your-app.up.railway.app`) and
  redeploy the API. A bare host and a trailing slash are accepted and
  normalized, but an explicit `http://` origin is rejected in production.
- **Login succeeds then bounces back to sign-in** — `CLIENT_ORIGIN` must match
  the browser's exact origin, and the API must be redeployed after the change.
- **Health shows `database: disconnected`** — `MONGODB_URI` is wrong or the
  MongoDB service is stopped; rebuild the value from the reference picker.
- **`could not determine how to build`** — the builder is still auto-detect; set
  **Builder** to `Dockerfile` and fill in the Dockerfile path.

## Current UI

The client includes a public landing page, registration and sign-in screens,
a protected workspace with profile editing and playlist import, a course
curriculum page with progress-aware lessons, suggested pacing or a saved study
schedule, and AI placement-test navigation. Course setup retains transcript
entry and AI outline controls at `/courses/:courseId/setup`. The responsive
course player supports lesson progress, notes, and bookmarks; course quizzes
include diagnostic placement tests and saved results. Weekly progress tracking,
an explicit study timer, and a course-aware AI tutor with lesson citations are
also available. The current outline generator groups imported playlist videos
from their titles and metadata; transcript-timestamp segmentation is not yet
implemented.
