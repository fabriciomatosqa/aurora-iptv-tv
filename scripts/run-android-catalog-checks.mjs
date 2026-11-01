// CI-only validation on a freshly installed Android TV emulator APK.
import {spawnSync} from "node:child_process";
import {mkdirSync,writeFileSync,readFileSync} from "node:fs";
import {performance} from "node:perf_hooks";
const pkg="br.com.auroraiptv.tv",out="apps/android-tv/app/build/catalog-evidence";
mkdirSync(out,{recursive:true});
function adb(args,timeout=30000){
  const result=spawnSync("adb",args,{encoding:"utf8",timeout,maxBuffer:32*1024*1024});
  if(result.error||result.status!==0)throw Error(result.error?.message||result.stderr||result.stdout);
  return result.stdout;
}
const component=pkg+".test/androidx.test.runner.AndroidJUnitRunner";
// Gradle's connected-test cleanup removes both packages and their private evidence.
// Install and run the complete instrumentation suite directly, retaining that same
// emulator installation for the opt-in matrix and actual process restart below.
adb(["install","-r","apps/android-tv/app/build/outputs/apk/debug/app-debug.apk"],120000);
adb(["install","-r","apps/android-tv/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk"],120000);
try{
  const smoke=adb(["shell","am","instrument","-w",component],10*60*1000);
  writeFileSync(out+"/instrumentation-suite.txt",smoke);console.log(smoke);
  if(!/OK \(\d+ tests?\)/.test(smoke)||/FAILURES!!!|INSTRUMENTATION_FAILED/.test(smoke))throw Error("Android TV instrumentation suite failed");
  const result=adb(["shell","am","instrument","-w","-e","class",pkg+".CatalogPerformanceTest#measureMatrix","-e","catalogBenchmark","true","-e","catalogLeaveFixture","true","-e","catalogSizes","10000,100000,300000,600000,1200000",component],3*60*60*1000);
  writeFileSync(out+"/instrumentation.txt",result);console.log(result);
  if(!result.includes("OK (1 test)"))throw Error("Android TV benchmark failed");
}finally{
  for(const name of ["tv-catalog-benchmark.json","tv-cache-first-playback.json"]){
    try{const text=adb(["shell","run-as",pkg,"cat","files/"+name]);writeFileSync(out+"/"+name,text);console.log(text);}catch(error){console.error(error.message);}
  }
  const screenshot=spawnSync("adb",["exec-out","run-as",pkg,"cat","files/tv-paged-catalog.png"],{timeout:30000});
  if(screenshot.status===0)writeFileSync(out+"/tv-paged-catalog.png",screenshot.stdout);
  writeFileSync(out+"/logcat.txt",adb(["logcat","-d"]));
}
const matrix=JSON.parse(readFileSync(out+"/tv-catalog-benchmark.json","utf8"));
if(JSON.stringify(matrix.map(row=>row.rows))!=="[10000,100000,300000,600000,1200000]"||matrix.some(row=>!row.elapsed_ms.two_episodes_added))throw Error("Incomplete Android TV matrix");
await import("./verify-android-restart.mjs");
