# Test on Windows/Linux (development preview)

## Requirements
Any current browser, Python 3 for local HTTP serving; Node.js 20+ for core tests and unpacked package staging.

1. Clone the feature branch.
2. From the repository root: python -m http.server 8080 on Windows, or python3 -m http.server 8080 on Linux.
3. Open http://localhost:8080/ in your browser.
4. Use arrow keys to move focus, Enter to activate, Escape/Backspace to go back.
5. Click Testar vídeo livre on Home; this uses a CC0 flower sample hosted by MDN.
6. Add an authorized M3U by URL (CORS permitting) or paste sample M3U text in Configurações.
7. Verify search, favorites, playlist switching, series grouping and exit from player.

To run parser automated tests: npm test. To syntax-check: npm run check.
To assemble UNPACKED webOS/Tizen prototype trees: npm run package:tv. These are not official installable/signed packages.

## Minimal M3U test data (do not include paid channels)
#EXTM3U
#EXTINF:-1 group-title="Filmes",Flor - demonstração CC0
https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4

## Device validation not completed
Samsung Tizen Studio emulator and signed WGT; LG webOS TV simulator and IPK; Android TV emulator and native Media3 player; VIDAA official SDK/devkit. Browser playback is not evidence of hardware compatibility.

## Known limitations
Browser URL playlist fetch can fail from server CORS even when the playlist works in a native app. localStorage quota makes this unsuitable for very large provider playlists. Some user stream formats cannot play in HTML5 video. Caching is not offline media downloading.
