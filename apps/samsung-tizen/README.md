# Samsung Tizen — initial web shell

Run npm run package:tv to generate an UNPACKED development directory in dist/samsung-tizen. This is not a signed WGT and has NOT been tested on a Samsung TV.

Open or import as a TV Web Application in Tizen Studio. Replace development manifest identifiers with the values assigned by Tizen Studio. Configure applicable CSP, vendor permissions and author/distributor certificates.

The prototype currently uses HTML5 video for PC preview, NOT AVPlay. AVPlay and hardware codec/error handling are required before Samsung compatibility can be claimed.

Official guides:
https://developer.samsung.com/smarttv/develop/getting-started/creating-tv-applications.html
https://developer.samsung.com/smarttv/develop/guides/multimedia/media-playback/using-avplay.html
