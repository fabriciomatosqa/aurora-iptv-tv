// Makes unpacked test directories only. Does NOT generate signed WGT or IPK.
import { mkdir, cp, copyFile, rm } from "node:fs/promises";
for (const platform of ["samsung-tizen", "lg-webos"]) {
  const dir = "dist/" + platform;
  await rm(dir, { recursive:true, force:true });
  await mkdir(dir, { recursive:true });
  await copyFile("index.html", dir + "/index.html");
  await cp("src", dir + "/src", { recursive:true });
  if (platform === "samsung-tizen") await copyFile("apps/samsung-tizen/config.xml", dir + "/config.xml");
  else await copyFile("apps/lg-webos/appinfo.json", dir + "/appinfo.json");
  console.log("Unpacked development directory:", dir);
}
