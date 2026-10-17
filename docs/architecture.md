# Architecture decision — AURORA IPTV TV 0.1.0

## Goals
One TV-first experience, platform-specific media/input adapters, no included content, support Android TV, Tizen, webOS and (subject to formal access) VIDAA.

## Decision
Start with a portable web view layer in plain ECMAScript, HTML and CSS for remote-navigation experiments on the PC. Feature domain modules under src/core/ can be reused by native-host wrappers or migrated to TypeScript later.

This is a functional UI proof, not proof of four-platform compatibility. Android TV will require TV-native packaging and Media3. Tizen must evaluate AVPlay, LG its supported playback path, VIDAA official APIs.

## Implemented now
- TV-first 16:9 responsive UI, fixed sidebar and vector UI icons.
- D-pad spatial focus; OK, Escape/Backspace, pointer click and wheel as provided by browser.
- M3U parser with conservative live/movie/series classification and grouping series.
- Multiple user playlists, selection, deletion, manual refresh (CORS applies in browser).
- Local favorites, recent items and VOD resume where supported.
- Browser video playback of user sources or one CC0 demonstration clip.
- Football page with no fake matches, placeholder until real EPG integration.

## Intentionally deferred
Native packages; license/DRM interoperability; EPG ingestion; football sports feeds; advanced media track selection; parental PIN; 20 translations; advanced scroll virtualization; secure credential storage; automatic daily refresh; tuner/performance regression suites. No platform certification.

## Privacy & limitations
localStorage in the prototype is NOT an encrypted credential vault and has a small storage quota. Do not use real private provider credentials in shared browser instances. Production will need local secure stores and streaming catalogue import backed by SQLite/IndexedDB or equivalent.

A playlist URL can contain login credentials. Never commit it to Git. Do not log it, send it to third-party services, or add provider streams to automated CI.

## Revisão 0.2.0

O protótipo implementou importação XMLTV, agenda de confrontos sem placares falsos, PIN PBKDF2, sincronização diária básica, integração Android Media3 e builds de desenvolvimento webOS. Ainda depende de validação real nas TVs e de arquitetura de cache escalável (IndexedDB/SQLite).
