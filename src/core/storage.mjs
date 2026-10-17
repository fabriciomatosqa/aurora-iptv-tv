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
  try { localStorage.setItem(KEY, JSON.stringify(state)); return true; }
  catch { return false; }
}
export function itemKey(item, playlistId) {
  return String(playlistId || "demo") + "|" + (item.type === "series" ? "series:" + item.title : item.url);
}
