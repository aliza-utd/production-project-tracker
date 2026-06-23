# Project Tracker

A static single-page web app for managing web development projects. No build step, no backend — just open `index.html` or host on GitHub Pages.

## Features

- **Project List** — sortable table with all projects and phase badges
- **Kanban Board** — drag-and-drop cards across phases; urgency highlight when Live Date ≤ 7 days away
- **Project Detail Modal** — inline editing of all fields, per-phase notes and checklists, Google Sheet links
- **Weekly Tracker** — per-week dashboard with 6 sections; navigate to previous weeks
- **Filters** — search, year (kickstart or live date), developer, and phase filters
- **localStorage** — all data persists in the browser automatically
- **Export / Import JSON** — backup and restore data

## Phases

1. Kickstart → 2. Setup → 3. Production (Development / Checking / Web Services) → 4. QA (Initial / Go-Live / Live Checking) → 5. Go-Live → 6. Activation → 7. Live → On-Hold / Cancelled

## Running Locally

Just open `index.html` in any modern browser — no server needed.

## Deploy to GitHub Pages

1. Create a new GitHub repository (public).
2. Push this project to the `main` branch:
   ```bash
   git init
   git add index.html README.md
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```
3. Go to **Settings → Pages** in your repository.
4. Under **Source**, select `Deploy from a branch`, choose `main`, folder `/` (root).
5. Click **Save**. Your site will be live at `https://YOUR_USERNAME.github.io/YOUR_REPO/` within a minute.

## Data & Backup

- All data lives in your browser's `localStorage` under the key `pt_data`.
- Use **Export JSON** (sidebar or Settings) to download a backup file.
- Use **Import JSON** to restore from a backup on any device.
- Clearing browser data will erase all projects — export regularly.
