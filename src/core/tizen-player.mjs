// Samsung TV AVPlay adapter. Device-only; unavailable in ordinary browsers.
// Follows Samsung's OPEN -> PREPARE -> PLAY -> STOP -> CLOSE lifecycle.
export function hasTizenPlayer() { return typeof globalThis.webapis?.avplay?.open==="function"; }
let videoObject=null;
export function startTizenPlayer(url,resumeSeconds=0,onError=()=>{},onEnd=()=>{}) {
  if(!hasTizenPlayer())return false;
  const p=globalThis.webapis.avplay;
  try{
    videoObject=document.createElement("object");
    videoObject.type="application/avplayer";
    videoObject.id="aurora-tizen-native-video";
    videoObject.style.cssText="position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:20";
    document.getElementById("player-root").prepend(videoObject);
    p.open(url);
    p.setDisplayRect(0,0,1920,1080); // AVPlay coordinate system is fixed, not physical 4K.
    p.setDisplayMethod("PLAYER_DISPLAY_MODE_LETTER_BOX");
    p.setListener({
      onbufferingstart:()=>{},
      onbufferingcomplete:()=>{},
      onstreamcompleted:()=>onEnd(),
      onerror:()=>onError("A transmissão não pôde ser reproduzida pelo AVPlay."),
      oncurrentplaytime:()=>{}
    });
    p.prepareAsync(()=>{
      try{
        if(resumeSeconds>0 && Number.isFinite(resumeSeconds))
          p.seekTo(Math.floor(resumeSeconds*1000),()=>p.play(),()=>p.play());
        else p.play();
      }catch{onError("Falha ao iniciar a reprodução no AVPlay.");}
    },()=>onError("O AVPlay não conseguiu preparar a transmissão."));
    return true;
  }catch{
    stopTizenPlayer();
    return false;
  }
}
export function tizenPositionSeconds() {
  if(!hasTizenPlayer())return 0;
  try{return Math.max(0,globalThis.webapis.avplay.getCurrentTime()/1000);}catch{return 0;}
}
export function toggleTizenPlayback(){
  if(!hasTizenPlayer())return;
  try{
    const p=globalThis.webapis.avplay;
    if(p.getState()==="PLAYING")p.pause();
    else if(p.getState()==="PAUSED")p.play();
  }catch{ /* Not in a valid playback state. */ }
}
export function seekTizen(seconds){
  if(!hasTizenPlayer())return;
  try{
    const p=globalThis.webapis.avplay;
    if(!["PLAYING","PAUSED","READY"].includes(p.getState()))return;
    p.seekTo(Math.max(0,Math.floor((tizenPositionSeconds()+seconds)*1000)),()=>{},()=>{});
  }catch{ /* Stream is not seekable. */ }
}
export function stopTizenPlayer(){
  if(hasTizenPlayer()){
    try{
      const p=globalThis.webapis.avplay;
      if(p.getState()!=="NONE")p.stop();
      p.close();
    }catch{ /* Already released by platform. */ }
  }
  videoObject?.remove();videoObject=null;
}
