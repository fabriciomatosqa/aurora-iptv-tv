// LG-only progressive UI polish. Does not modify the shared playlist/player state.
const root = document.getElementById("app");
if (root) {
  let lastToast = "";
  let lastToastAt = 0;
  const messageMatcher = /(não conseguiu reproduzir|não foi possível reproduzir|formato.*codecs|falha ao iniciar.*reprodução)/i;
  const searchHints = {
    "Ao Vivo": "Buscar um canal pelo nome…",
    "Filmes": "Buscar um filme pelo nome…",
    "Séries": "Buscar uma série pelo nome…",
    "Favoritos": "Buscar nos favoritos…",
    "Sem classificação": "Buscar conteúdo pelo nome…"
  };
  let processing = false;
  function updateInterface() {
    if (processing) return;
    processing = true;
    try {
      const title = root.querySelector("main > h2");
      const page = title?.textContent?.trim() || "";
      const search = root.querySelector('input[data-input="search"]');
      if (search && searchHints[page] && search.placeholder !== searchHints[page]) {
        search.placeholder = searchHints[page];
      }

      const bar = root.querySelector(".topbar .topright");
      if (bar && bar.textContent !== "SETAS: navegar   •   OK: selecionar   •   VOLTAR: sair") {
        bar.textContent = "SETAS: navegar   •   OK: selecionar   •   VOLTAR: sair";
      }

      // The shared prototype intentionally renders at most 180 cards at once.
      // Clearly tell users why searching can reveal additional items.
      const countText = root.querySelector("main > .subtitle");
      const firstGrid = root.querySelector("main > .cards");
      const total = Number(countText?.textContent?.match(/^([\d.]+)/)?.[1]?.replace(/\./g, "") || 0);
      let summary = root.querySelector(".lg-results-summary");
      if (firstGrid && total > firstGrid.children.length && firstGrid.children.length >= 180) {
        if (!summary) {
          summary = document.createElement("p");
          summary.className = "lg-results-summary";
          firstGrid.before(summary);
        }
        const label = "Exibindo " + firstGrid.children.length + " de " + total + " itens. Use a busca acima para encontrar os demais.";
        if (summary.textContent !== label) summary.textContent = label;
      } else if (summary) summary.remove();

      const notice = root.querySelector("main > .notice");
      if (notice) {
        const isError = messageMatcher.test(notice.textContent);
        notice.classList.toggle("lg-notice-error", isError);
        if (isError) {
          const value = notice.textContent.trim();
          const now = Date.now();
          if (value === lastToast && now - lastToastAt < 30_000) {
            notice.remove();
          } else if (notice.dataset.lgToast !== "yes") {
            lastToast = value;
            lastToastAt = now;
            notice.dataset.lgToast = "yes";
            setTimeout(() => { if (notice.isConnected) notice.remove(); }, 7_000);
          }
        }
      }
    } finally {
      processing = false;
    }
  }
  const observer = new MutationObserver(updateInterface);
  observer.observe(root, { childList: true, subtree: true });
  updateInterface();
}
