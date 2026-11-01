// Actual process restart; retries accessibility capture independently of app readiness.
import {spawnSync} from "node:child_process";
import {mkdirSync,writeFileSync} from "node:fs";
import {performance} from "node:perf_hooks";
const pkg="br.com.auroraiptv.tv",out="apps/android-tv/app/build/catalog-evidence";
mkdirSync(out,{recursive:true});
function adb(args){const r=spawnSync("adb",args,{encoding:"utf8",timeout:30000});if(r.error||r.status!==0)throw Error(r.stderr||r.error?.message||r.stdout);return r.stdout;}
const start=performance.now();adb(["shell","am","force-stop",pkg]);
const launch=adb(["shell","am","start","-W","-n",pkg+"/.MainActivity"]);
let xml="",home=false,ready=false;const captures=[];
async function capture(){
  try{captures.push(adb(["shell","uiautomator","dump","--compressed","/data/local/tmp/aurora-tv-window.xml"]));return adb(["shell","cat","/data/local/tmp/aurora-tv-window.xml"]);}catch(error){captures.push(error.message);await new Promise(r=>setTimeout(r,500));return "";}
}
for(let i=0;i<12;i++){xml=await capture();if(xml.includes("Explorar canais")){home=true;break;}}
const homeMs=performance.now()-start;
if(home){adb(["shell","input","keyevent","20"]);adb(["shell","input","keyevent","23"]);}
for(let i=0;i<12;i++){xml=await capture();if(xml.includes("Canal 15")){ready=true;break;}}
writeFileSync(out+"/force-stop-window.xml",xml);
const result={launch_output:launch,observed_home_ms:homeMs,observed_cached_channel_ms:performance.now()-start,includes_accessibility_dump_overhead:true,remote_source:"none configured",home,ready,captures};
writeFileSync(out+"/force-stop.json",JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
if(!ready)throw Error("Cached TV channel not visible after process restart and D-pad navigation");
