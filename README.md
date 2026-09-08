# Frequency

A private music vault built with vanilla HTML/CSS/JS and Supabase.

## 1. Create Supabase

Create a Supabase project. Open SQL Editor and run `supabase.sql`.

The SQL creates private audio/cover buckets, tables, and row-level security. Audio and artwork are stored by user ID and the browser requests short-lived signed URLs when playing/showing them.

## 2. Add your Supabase keys

Open `app.js` and replace:

`YOUR_SUPABASE_URL`

`YOUR_SUPABASE_PUBLISHABLE_KEY`

with your project's URL and publishable/anon key. Never put a service-role key in this file.

## 3. Run it

For a quick local test, open `index.html` through a local static server. VS Code Live Server works well. You can also deploy the folder to GitHub Pages.

## 4. GitHub Pages

Create an empty repository named `frequency`, upload all files in this folder, then enable Pages for the `main` branch and `/root` (or `/` depending on GitHub's current UI).

## Current real functionality

- Supabase email/password authentication
- Private per-user track library
- Private audio and artwork storage
- Audio uploads
- Artwork uploads
- Circular collection view
- Traditional list view
- View preference saved in localStorage
- Search
- Album grouping
- Playlist creation + cover upload
- Persistent bottom player
- Play/pause, previous, next
- Seek/progress
- Volume
- Shuffle/repeat
- Responsive mobile layout
- Touch/pointer swipe behavior for collection and wheel/trackpad navigation

## Next production features

The next pass should add playlist track management/reordering, playlist editing/deletion, track editing/deletion, automatic audio duration extraction, drag momentum polish, full-screen Now Playing, mobile swipe-to-skip in Now Playing, profile/settings, PWA install support, and stronger upload validation.
