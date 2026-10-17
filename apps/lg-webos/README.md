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

## LG 0.3.0 — Aurora Home e catálogo em duas colunas de navegação

Referência visual enviada pelo usuário: painel de TV com três grandes entradas de conteúdo (Ao Vivo, Filmes, Séries) e dois atalhos (Favoritos, Histórico).

### Alterações exclusivas à LG
- Nova página inicial sem a antiga barra lateral: logo Aurora, data/hora local, acesso a Configurações e cartões grandes Ao Vivo, Filmes, Séries, Favoritos e Histórico; atalho para Futebol na base.
- Ao selecionar um tipo, são exibidas duas colunas **fixas** à esquerda: navegação principal (Início, Ao Vivo, Filmes, Séries, Favoritos, Histórico, Futebol e Configurações) e subcategorias derivadas diretamente dos grupos reais `group-title` da M3U.
- O painel da direita mostra cartões do grupo escolhido; há opção **Todos os conteúdos** e busca dentro do grupo ativo. A lista completa continua sendo percorrida com carregamento incremental de 48 cards.
- Seleção com controle remoto ganha foco visível nas duas colunas e nos cards. Ambas as colunas rolam independentemente, enquanto o menu principal permanece parado quando o catálogo rola.
- Favoritos e Histórico integram a mesma navegação, sem apagar listas, arquivos de cache, EPG ou retomada.
- Subcategorias inexistentes não são inventadas: etiquetas e contagens são extraídas dos itens presentes na playlist, sem comunicação com serviços externos.

### Download e validação
- Branch: `feature/lg-webos-home-and-categories`.
- GitHub Actions: `Build LG webOS developer IPK`, baixar **aurora-iptv-tv-lg-simulator-folder** de uma execução aprovada dessa branch.
- Extraia o ZIP e selecione a pasta que contém `appinfo.json` no LG webOS TV 26 Simulator.
- Teste sequência: Início → Ao Vivo → subcategoria → card; Voltar → Início; Filmes e Séries; Favoritos/Histórico; Configurações.
- Compilação e Chromium automatizado não substituem teste em hardware LG real.

## LG 0.4.0 — navegação específica por conteúdo

Esta atualização altera **exclusivamente a experiência LG webOS**. A Home mantém os cartões grandes. O painel Futebol mostra confrontos encontrados nos horários reais do XMLTV, um botão por jogo; ao selecionar, abre o canal associado sem navegar antes para a lista de canais. Sem EPG válido, exibe informação de ausência, nunca partidas fictícias.

- **Ao Vivo:** plataforma (da M3U) → canal (exclusivamente conteúdo tipo `live`) → EPG do canal, com programa atual, próximos programas e botão **Assistir canal**.
- **Filmes:** gênero (quando informado pelo `group-title` ou metadados explícitos) → plataforma → filmes com filtragem real.
- **Séries:** plataforma → séries agrupadas por título e plataforma → episódios ordenados por temporada/episódio identificados no título. Pode favoritar a série; os episódios abrem diretamente.
- Navegação por D-pad, OK e Voltar. Estado do filtro é preservado durante a troca para Configurações e retorno. As três colunas são independentes, com rolagem própria.
- Quando a playlist não fornece gênero ou plataforma, a interface exibe explicitamente **Gênero não informado** ou **Plataforma não informada**, sem deduzir categorias a partir de nomes de filmes ou canais.
- A área Futebol usa canais correspondentes ao XMLTV importado e mantém o tempo da transmissão, sem placares ou partidas inventadas.
- O parser de listas do projeto e os players de outras plataformas foram preservados; componentes novos usam `lgTv` e CSS empacotado apenas no webOS.
- Persistência de listas e favoritos, controle parental +18, EPG e carregamento progressivo de filmes seguem utilizando as funções existentes.

### Como testar
Acesse a execução verde mais recente da branch `feature/lg-webos-triple-navigation` no workflow **Build LG webOS developer IPK**. Em *Artifacts*, baixe **aurora-iptv-tv-lg-simulator-folder**, extraia e selecione a pasta com `appinfo.json` no webOS TV 26 Simulator. O IPK de desenvolvimento é separado.

**Limitações:** Plataformas/gêneros dependem da organização do provedor na M3U; conteúdo sem metadados não pode ser classificado por empresa sem dados externos; streaming e codecs dependem da compatibilidade do simulador e da TV real. Jogos aparecem quando o XMLTV possui confrontos identificáveis e canal correspondente.

## LG 0.4.1 — correções de catálogo e navegação observadas no Simulator 26

- **Separação correta**: canais como A&E, AMC e AXN que aparecem em grupos ambíguos `FILMES E SÉRIES` não são mais forçados em Filmes. Episódios com S01E01 continuam em Séries; arquivos de VOD com caminhos ou extensões confiáveis aparecem em Filmes. Entradas realmente ambíguas ficam em **Sem classificação**, com acesso pela Home.
- **Plataforma pelo próprio M3U**: recupera etiquetas com símbolos, como `♦ Netflix` ou `✦ Crunchyroll`, e atributos opcionais `provider`, `platform`, `genre`, sem assumir uma plataforma a partir do nome do vídeo.
- **Contagem e atualização**: mantém URLs antigas, remove duplicados por URL nas atualizações, substitui metadados de itens existentes para que correções persistam. Catálogos já armazenados são reclassificados na abertura, preservando favoritos e posições.
- **Busca no controle remoto**: primeira e segunda colunas têm pesquisa quando há muitos resultados; a segunda renderiza até 120 itens inicialmente e permite carregar os demais, procurando em todo o catálogo filtrado.
- **Foco e rolagem**: preserva a posição das colunas ao navegar. Cartazes pequenos junto às séries quando houver imagem válida.
- **EPG**: substitui três avisos repetidos de ausência de guia por um estado vazio claro com atalho para Configurações.
- **Home e Futebol**: retira o segundo botão duplicado do Futebol; quando não há partidas identificadas no EPG, exibe instruções e acesso para importar o guia, sem placares fictícios.
- **Reprodução**: uma falha de codec/rede aparece dentro do próprio player LG e não fica permanentemente sobre a página inicial após sair.

### Importante

Sem acesso ao M3U/XMLTV completo do usuário não é possível assegurar a classificação de todas as entradas. O aplicativo agora distingue dados realmente reconhecíveis daqueles que necessitam de revisão; isso é intencional. O Simulator webOS nem sempre reproduz os mesmos formatos que uma TV LG física.

### Como testar

Na branch `feature/lg-webos-catalog-fixes-v041`, execute ou aguarde **Build LG webOS developer IPK**. Baixe `aurora-iptv-tv-lg-simulator-folder` nos Artifacts da execução verde, extraia e escolha a pasta com `appinfo.json` no Simulator 26. Teste A&E e AMC em Ao Vivo, Filmes sem esses canais, plataformas Netflix em Séries, busca de séries distantes e retorno do player para Home.
