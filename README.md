# Gig Book

Chords and lyrics for playing gigs from your phone or tablet. Make a gig, type your songs in, and play from it on stage. Sign in and your gigs are the same on all your devices, and your band can join a gig with one link.

**Open it:** https://vibesbg.github.io/gig-book/

<img src="screenshot.png" alt="A song in the app: key and capo buttons, tempo, and chord charts" width="300"> <img src="screenshot-list.png" alt="The example gig with two sets and a break" width="300">

## Use it for your band

1. Open the link. It starts with an example gig of two songs, so open them and try things out. The example steps aside as soon as you make or load your own gig.
2. Tap **Make your own gig**, give it a name, and add your songs.
3. Type each song's chords (see below). Add sets and breaks, and put everything in order with ↑ ↓.
4. Add the app to your Home Screen. After the first visit it works without internet.

## Typing a song

Section name on its own line, chords separated by `|`, and `x2` at the end of a line to repeat it:

```
Verse
G | D | Am | C  x2
Chorus
C | G | D | D
```

## What it does

- Transpose the key, and a capo calculator that keeps the sound and changes the shapes
- Tap any chord to see how to play it
- Metronome with count-in and tap tempo
- Auto-scroll, swipe between songs, and works with a Bluetooth page-turner pedal
- Notes per song, mark songs as played, search across gigs
- Chords and lyrics for every song, with a Chords | Lyrics switch (singers can open songs in lyrics)
- **Sync:** sign in with Google or email, and your gigs, lyrics, keys and notes are the same on every device. Works offline; changes go up when you're back online
- **Band link:** ↗ Send › Send invite link. Bandmates join once and always have your latest version; they can only look unless you let them edit
- Or send a gig as a file (Viber, WhatsApp, Messenger)
- Stage (dark) and Daylight looks, adjustable text size, keeps the screen on
- English and Bulgarian

## Your data

Not signed in, everything stays on your own device. Signed in, your gigs are also kept in your account (Firebase), and only you and the band members of a gig you share can see them. **Save gig to file** keeps a backup, **Load a file** opens one.

## For developers

One static page. Sync uses Firebase (Authentication + Firestore), loaded only after you sign in; the security rules are in `firestore.rules`. `index.html` is built from `src/template.html`, `src/core.js` and `src/example.json`:

```
py -I src/build.py
```

Tests run in a browser: open `tests/core.test.html` directly, or serve the repo folder (`py -m http.server`) and open `tests/ui.test.html`.

---

Made by Dimitar Vasilev
