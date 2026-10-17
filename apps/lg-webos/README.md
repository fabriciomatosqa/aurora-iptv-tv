# LG webOS — initial web shell

Run npm run package:tv to generate dist/lg-webos with appinfo.json, index.html and src/. GitHub Actions additionally runs the official webOS CLI to create a development IPK. It has not yet been validated on a TV.

For developer builds, install LG's current webOS CLI, then package the generated folder using the official ares-package command. Test in LG webOS Simulator and on real TVs in Developer Mode. Video decoding in simulator differs from TV hardware.

The current HTML5 preview has not passed webOS playback tests; check platform media APIs and codecs before publication.

https://webostv.developer.lge.com/develop/getting-started/build-your-first-web-app
https://webostv.developer.lge.com/develop/tools/cli-introduction


## GitHub Actions IPK

The workflow `.github/workflows/webos-tv.yml` builds a development IPK using `@webos-tools/cli@3.2.6` and uploads it as artifact. An IPK package is not equivalent to LG Content Store approval. The generated 80px/130px icons are TEMPORARY dev placeholders, not a replacement for the AURORA official logo.
