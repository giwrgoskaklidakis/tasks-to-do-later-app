# Later (tasks-to-do-later-app)

A tiny app for saving thoughts, articles and things you want to do or check later — e.g. an article you found and want to read, a phone call you need to make, or any other reminder.

No account, no server: everything is stored locally in your browser (`localStorage`).

## Live app

https://giwrgoskaklidakis.github.io/tasks-to-do-later-app/

Deployed automatically to GitHub Pages on every push to `main` (requires Settings → Pages → Source: "GitHub Actions").

## Features

- Add an item with a title, optional link, category and note.
- Mark items as done / pending.
- Edit and delete items.
- Filter by status, category and free-text search.
- Sort by date.
- Clear all completed items in one click.

## Fast — fasting tracker (`fasting/`)

A second app in this repo for tracking intermittent fasts: https://giwrgoskaklidakis.github.io/tasks-to-do-later-app/fasting/

- One-tap start / end, with a live progress ring toward your goal.
- Goal presets (13:11, 14:10, 16:8, 18:6, 20:4, 24h, 36h) or a custom number of hours.
- Fix the start time if you forgot to start the timer.
- Rough fasting-stage hints (general guidance, not medical advice).
- Stats: number of fasts, day streak, average, longest, goal hit rate, and a last-7-days chart.
- History with edit and delete.
- Stored in `localStorage`; synced per user when hosted on claude.ai, same as Later.

## Run locally

No build step. Open `index.html` (or `fasting/index.html`) in a browser, or serve the folder:

```bash
npx serve .
```

## Tech

Plain static HTML/CSS/JavaScript, no dependencies.
