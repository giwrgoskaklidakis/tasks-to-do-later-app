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

## Run locally

No build step. Open `index.html` in a browser, or serve the folder:

```bash
npx serve .
```

## Tech

Plain static HTML/CSS/JavaScript, no dependencies.
