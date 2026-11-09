# SingingBowl
A synthesis of a singing bowl sound written in javascript using webaudio api

## Install as an app
The app is a Progressive Web App. Serve it over `http://localhost` (XAMPP) or
HTTPS, open it in Chrome or Edge and use the **Install** button in the top bar.
On iOS Safari use **Share → Add to Home Screen**.

A service worker (`sw.js`) caches the app shell, so the app also works offline
after the first visit.

## Saved settings
Master volume, partial frequencies, gains and switch states as well as the group
gain and decay time are stored in the browser's `localStorage` and restored
automatically on the next start.

## Documentation
The app includes an English in-app documentation. Open it with the **Docs**
button in the header.
