# Android TV / Google TV — adapter pending

The browser prototype is NOT an Android TV APK. Native work must create a TV launcher Activity and integrate Media3/ExoPlayer with platform capabilities (including HLS and direct stream formats). Decide whether the TV UI should be implemented with Compose for TV or hosted in a hardened WebView and expose a minimal player bridge. Confirm D-pad focus, back stack, codecs and remote media keys on an Android TV emulator and a real device.

No package, emulator test or native integration is claimed yet. APK/AAB work begins after phase-2 compatibility proof.
Official references: https://developer.android.com/training/tv and https://developer.android.com/media/media3/exoplayer/hello-world
