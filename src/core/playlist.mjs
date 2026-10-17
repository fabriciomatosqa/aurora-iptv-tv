// M3U parser: conservative classification, no provider data or credentials embedded.
export function classifyItem(group = "", title = "") {
  const g = String(group).toLocaleLowerCase("pt-BR");
  const t = String(title);
  if (/(^|[\s\W])(s[ée]ries?|series|seriados|tv\s*shows)([\s\W]|$)/i.test(g) ||
      /(?:^|\s)(?:s\d{1,3}e\d{1,3}|\d{1,3}x\d{1,3})(?:\b|$)/i.test(t)) return "series";
  if (/(^|[\s\W])(filmes?|movies?|cinema|vod)([\s\W]|$)/i.test(g)) return "movies";
  if (/(^|[\s\W])(ao\s*vivo|canais?|live|esportes?|sports?|not[ií]cias?|news|tv)([\s\W]|$)/i.test(g)) return "live";
  return "unknown"; // Never silently place episodes or movies into TV channels.
}
export function seriesTitle(title) {
  return String(title).replace(/\s*[-–.]?\s*(?:s\d{1,3}e\d{1,3}|\d{1,3}x\d{1,3})\b.*$/i, "").trim() || String(title);
}
export function parseM3U(text) {
  if (typeof text !== "string" || !text.trimStart().startsWith("#EXTM3U")) {
    throw new Error("O arquivo precisa começar com #EXTM3U.");
  }
  const items = [];
  let pending = null;
  let guideUrl = "";
  const firstLine = text.split(/\r?\n/, 1)[0];
  guideUrl = /(?:x-tvg-url|url-tvg)="([^"]*)"/i.exec(firstLine)?.[1] || "";
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith("#EXTINF:")) {
      const comma = line.indexOf(",");
      const descriptor = comma === -1 ? line : line.slice(0, comma);
      const attrs = {};
      for (const match of descriptor.matchAll(/([\w-]+)="([^"]*)"/g)) attrs[match[1].toLowerCase()] = match[2];
      pending = {
        title: (comma < 0 ? "" : line.slice(comma + 1)).trim() || attrs["tvg-name"] || "Sem título",
        group: attrs["group-title"] || "",
        logo: attrs["tvg-logo"] || "",
        tvgId: attrs["tvg-id"] || ""
      };
    } else if (pending && line && !line.startsWith("#")) {
      try {
        const url = new URL(line);
        if (url.protocol === "http:" || url.protocol === "https:") {
          items.push({ ...pending, url: line, type: classifyItem(pending.group, pending.title) });
        }
      } catch { /* Ignore malformed media URLs. */ }
      pending = null;
    }
  }
  return { items, guideUrl, count: items.length };
}
export function groupSeries(items) {
  const groups = new Map();
  for (const item of items.filter(i => i.type === "series")) {
    const title = seriesTitle(item.title);
    const key = title.toLocaleLowerCase("pt-BR");
    if (!groups.has(key)) groups.set(key, { title, type: "series", logo: item.logo, episodes: [] });
    groups.get(key).episodes.push(item);
  }
  return [...groups.values()];
}
