# PadhaiHub
 PadhaiHub – A unified educational content discovery and intelligent ranking platform built for CODEWORD 2.0. Aggregates multi-format resources (videos, PDFs, articles) and ranks the best materials at the top using relevance, engagement, and ratings.

## Run locally

From the repository root, run `npm run dev`. The frontend runs on port 3000 and the Node.js backend runs on port 5000. Backend environment variables are loaded from `backend-node/.env`, regardless of the directory used to launch the backend.

## Deploy to Render

Deploy the Node.js backend as a Render Web Service from the repository root:

- Build command: `npm install --prefix backend-node`
- Start command: `npm --prefix backend-node start`
- Add the database and service credentials as Render environment variables; do not rely on a local `.env` file.
- Set a long, random `SESSION_SECRET` environment variable to sign profile-session tokens.

The backend serves the frontend pages itself, so opening the backend service URL keeps page requests and `/api` requests on the same origin. If the frontend is deployed as a separate static site, set `window.PADHAIHUB_API_BASE_URL` in `frontend/public/pages/api-config.js` to the backend service URL (for example, `https://your-backend.onrender.com`).
