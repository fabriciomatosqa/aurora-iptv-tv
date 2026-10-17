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
