// Local-calendar day semantics. A failed attempt is not repeated repeatedly in one session.
export function localDay(now = new Date()) {
  const pad=n=>String(n).padStart(2,"0");
  return now.getFullYear()+"-"+pad(now.getMonth()+1)+"-"+pad(now.getDate());
}
export function needsDailyUpdate(playlist, now = new Date()) {
  return Boolean(playlist?.url && playlist.lastAttemptDay !== localDay(now));
}
export function mergePlaylist(oldItems, newItems) {
  const result=Array.isArray(oldItems)?[...oldItems]:[];
  const keys=new Set(result.map(x=>x.url));
  let added=0;
  for(const it of newItems||[]){
    if(!it?.url || keys.has(it.url))continue;
    result.push(it);keys.add(it.url);added++;
  }
  return {items:result,added};
}
