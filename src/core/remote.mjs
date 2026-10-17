// Normalize keyboard and remote-control key codes across platforms.
export function remoteKey(event) {
  const c=Number(event?.keyCode||event?.which||0),key=event?.key||"";
  if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Enter","Escape","Backspace"].includes(key)) return key;
  if (key===" " || key==="Spacebar")return "PlayPause";
  if (["MediaPlayPause","MediaPause","MediaPlay"].includes(key))return "PlayPause";
  if (["MediaFastForward","MediaTrackNext"].includes(key))return "FastForward";
  if (["MediaRewind","MediaTrackPrevious"].includes(key))return "Rewind";
  if (key==="GoBack" || key==="BrowserBack" || key==="Return")return "Escape";
  const codes={19:"PlayPause",37:"ArrowLeft",38:"ArrowUp",39:"ArrowRight",40:"ArrowDown",13:"Enter",
    415:"PlayPause",416:"PlayPause",417:"FastForward",412:"Rewind",413:"Escape",10009:"Escape",461:"Escape",4:"Escape"};
  return codes[c] || key;
}
export function registerRemoteKeys() {
  const device=globalThis.tizen?.tvinputdevice;
  if(!device)return;
  const names=["MediaPlay","MediaPause","MediaPlayPause","MediaStop","MediaFastForward","MediaRewind"];
  try {device.registerKeyBatch(names);}catch {
    for(const name of names)try{device.registerKey(name);}catch{ /* Model-specific unsupported key */ }
  }
}
