const KEY = "aurora-tv-preview-v1";
const empty = () => ({ playlists: [], activeId: null, favorites: [], positions: {}, recent: [], theme: "dark" });
export function loadState() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || "null");
    return value && Array.isArray(value.playlists) && Array.isArray(value.favorites)
      ? { ...empty(), ...value } : empty();
  } catch { return empty(); }
}
export function saveState(state) {
  try {
    // Catalog and guide live in IndexedDB, not in localStorage's tiny quota.
    // Android migrates only the active legacy playlist. Retain old inline data for
    // inactive playlists until its own durable copy has committed successfully.
    const compact={...state,playlists:state.playlists.map(({items,guide,...meta})=>({...meta,
      ...(meta.legacyItemsPending?{items}:{}),...(meta.legacyGuidePending?{guide}:{})}))};
    localStorage.setItem(KEY,JSON.stringify(compact));return true;
  }
  catch { return false; }
}
export function itemKey(item, playlistId) {
  return String(playlistId || "demo") + "|" + (item.stateKey || (item.type === "series" ? "series:" + (item.favoriteSeriesTitle || item.title) : item.url));
}
