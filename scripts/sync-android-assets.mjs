// Bundle the exact shared web UI for the Android TV development APK.
import { cp, copyFile, mkdir, rm } from "node:fs/promises";
const out = "apps/android-tv/app/src/main/assets";
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await copyFile("index.html", out + "/index.html");
await cp("src", out + "/src", { recursive: true });
console.log("Synced static Aurora UI assets:", out);
