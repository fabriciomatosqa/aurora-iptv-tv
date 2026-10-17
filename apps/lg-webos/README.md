# LG webOS — initial web shell

Run npm run package:tv to generate dist/lg-webos with appinfo.json, index.html and src/. GitHub Actions additionally runs the official webOS CLI to create a development IPK. It has not yet been validated on a TV.

For developer builds, install LG's current webOS CLI, then package the generated folder using the official ares-package command. Test in LG webOS Simulator and on real TVs in Developer Mode. Video decoding in simulator differs from TV hardware.

The current HTML5 preview has not passed webOS playback tests; check platform media APIs and codecs before publication.

https://webostv.developer.lge.com/develop/getting-started/build-your-first-web-app
https://webostv.developer.lge.com/develop/tools/cli-introduction


## GitHub Actions IPK

The workflow `.github/workflows/webos-tv.yml` builds a development IPK using `@webos-tools/cli@3.2.6` and uploads it as artifact. An IPK package is not equivalent to LG Content Store approval. The generated 80px/130px icons are TEMPORARY dev placeholders, not a replacement for the AURORA official logo.

## Primeira revisão visual dedicada à LG — 0.2.0 LG UI (fase 1)

Esta branch mantém o núcleo do AURORA e **altera somente o pacote de interface LG**. Os arquivos `apps/lg-webos/index.html`, `lg-tv.css` e `lg-ui.mjs` são copiados para `dist/lg-webos` pelo empacotamento. A versão Android TV, o Tizen e o desktop não recebem esses estilos.

### Melhorias

- Catálogo com 4 cards por linha na resolução lógica do Simulator 26 (~1280px), até 5 em telas lógicas maiores.
- Títulos de até duas linhas, logos preservados sem zoom/corte, nomes de categorias mais legíveis.
- Menu lateral e foco por controle remoto mais aparentes.
- Busca ampliada, dica de navegação por setas/OK/Voltar e avisos visuais discretos.
- Erros de reprodução destacados como erro, em vez da barra de sucesso verde, e recolhidos após alguns segundos.
- Informação de que a versão atual exibe inicialmente apenas 180 registros, sem ocultar a possibilidade de buscar no catálogo completo.

### Testar com webOS TV 26 Simulator

1. No GitHub, abra a execução verde mais recente de **Build LG webOS developer IPK** para a branch `feature/lg-webos-tv-ui-first-pass`.
2. Baixe `aurora-iptv-tv-lg-simulator-folder` em **Artifacts**. Não utilize o artefato IPK no seletor de pastas.
3. Extraia o ZIP para uma pasta local. Selecione no Simulator **exatamente a pasta que contém diretamente `appinfo.json`**.
4. Teste Início e Ao Vivo, cards, teclado direcional, botão Voltar, busca e Configurações.
5. A screenshot de uma execução de teste automático, quando disponível, ficará em `aurora-iptv-tv-lg-visual-tests`.

A versão ainda é uma prévia e **não foi declarada validada em televisão física**. O limite atual de 180 cards renderizados e a reprodução de codecs exclusivos das TVs são pontos posteriores, separados da revisão de interface.

### Testes de desenvolvimento no computador

~~~sh
npm install
npm run package:tv
npx playwright install chromium
npx playwright test --config playwright.lg.config.mjs
~~~

O último comando testa a pasta gerada `dist/lg-webos`, e não o HTML compartilhado.

## LG 0.2.1 — menu fixo e catálogo completo (17/10/2026)

- A rolagem é confinada ao painel `main`, com menu lateral imóvel durante a navegação. O documento externo não deve rolar.
- O limite anterior de 180 cards foi eliminado **somente na versão LG**. A lista é navegável por lotes de 48 cards; o botão **Carregar mais** e a rolagem próxima ao final carregam os lotes seguintes. A pesquisa procura na lista inteira já importada.
- A importação M3U para LG contabiliza entradas `#EXTINF`, URLs válidas e URLs descartadas. O painel Configurações exibe os resultados quando houve importação nesta versão; playlists antigas mostram **Não disponível** para quantidades históricas desconhecidas.
- Compatibilidade adicional com `#EXTGRP` e títulos após atributos contendo vírgulas.
- Canais rotulados equivocadamente como "Série" podem ser identificados como **Ao Vivo** quando há marcadores fortes de emissora (`FHD/HD/SD/4K/H265` ou `tvg-id`) e não existe padrão de episódio. Itens ambíguos permanecem na classificação original.
- A classificação das playlists antigas é corrigida durante a leitura do IndexedDB e preservada no banco, sem recadastrar URLs nem perder favoritos/posições salvas.

### Limitações conhecidas

- O parser lê todo o M3U recebido em memória para montar o catálogo; listas gigantes exigirão importação em fluxo e índices no armazenamento local. Não há garantia de que o provedor entregou mais itens do que o HTTP retornou.
- O contador da interface mostra os itens efetivamente importados. Ele não confirma a quantidade anunciada externamente pelo provedor.
- O simulador pode reproduzir menos formatos de mídia que a TV real. Estas mudanças não alteram codecs nem URLs de reprodução.
- Os outros aplicativos do projeto não receberam mudanças visuais nem de comportamento: a correção de catálogo é condicionada à presença da classe `lg-tv` na página e está numa branch LG separada.

### Teste no webOS TV 26 Simulator

Abra o workflow `Build LG webOS developer IPK` da branch `feature/lg-webos-tv-ui-first-pass`, baixe o artefato `aurora-iptv-tv-lg-simulator-folder`, extraia e selecione diretamente a pasta que contém `appinfo.json`.
Confira se o logo fica no mesmo lugar ao rolar até canais distantes. Abra `Ao Vivo` e `Séries` e verifique a classificação. Em `Configurações`, veja os totais efetivamente importados e as entradas inválidas.
