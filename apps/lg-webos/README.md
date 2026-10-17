# LG webOS — initial web shell

Run npm run package:tv to generate dist/lg-webos with appinfo.json, index.html and src/. This is an UNPACKED development directory, not an IPK.

For developer builds, install LG's current webOS CLI, then package the generated folder using the official ares-package command. Test in LG webOS Simulator and on real TVs in Developer Mode. Video decoding in simulator differs from TV hardware.

The current HTML5 preview has not passed webOS playback tests; check platform media APIs and codecs before publication.

https://webostv.developer.lge.com/develop/getting-started/build-your-first-web-app
https://webostv.developer.lge.com/develop/tools/cli-introduction
