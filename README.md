# Halite

Private AI workspace for State and Local Tax (SALT) consulting professionals.

**Stack:** Node.js/Express (Railway) + Static HTML (Cloudflare Pages) + Claude API

## Deploy

Railway auto-detects via `railway.json`. Set env vars:
- `ANTHROPIC_API_KEY`
- `FRONTEND_URL` (Cloudflare Pages URL for CORS)

Cloudflare Pages: build output directory = `frontend` (tool) or `marketing` (marketing site).
