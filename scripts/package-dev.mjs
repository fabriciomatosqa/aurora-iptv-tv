// Makes unpacked test directories only. Does NOT generate signed WGT or IPK.
import { mkdir, cp, copyFile, rm, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
let generated=false;
for (const cmd of ["python3","python","py"]) {
  try { execFileSync(cmd, cmd==="py"?["-3","scripts/generate-dev-icons.py"]:["scripts/generate-dev-icons.py"],{stdio:"inherit"});generated=true;break; }
  catch (error) { if (error?.code!=="ENOENT") { console.warn("Icon generation failed with",cmd); } }
}
if(!generated) throw new Error("Python 3 is required to generate development icons.");
for (const platform of ["samsung-tizen", "lg-webos"]) {
  const dir = "dist/" + platform;
  await rm(dir, { recursive:true, force:true });
  await mkdir(dir, { recursive:true });
  await copyFile("index.html", dir + "/index.html");
  await cp("src", dir + "/src", { recursive:true });
  if (platform === "samsung-tizen") {
    await copyFile("apps/samsung-tizen/config.xml", dir + "/config.xml");
    // Samsung provides the AVPlay bridge through this special runtime script.
    const html=await readFile(dir+"/index.html","utf8");
    await writeFile(dir+"/index.html",html.replace("</head>",'  <script src="$WEBAPIS/webapis/webapis.js"></script>\n</head>'));
  }
  else { await copyFile("apps/lg-webos/appinfo.json", dir + "/appinfo.json"); await copyFile("dist/branding/icon.png",dir+"/icon.png"); await copyFile("dist/branding/largeicon.png",dir+"/largeicon.png"); }
  console.log("Unpacked development directory:", dir);
}
