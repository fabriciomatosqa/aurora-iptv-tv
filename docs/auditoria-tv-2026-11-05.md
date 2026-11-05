# Auditoria AURORA IPTV TV — 05/11/2026

Escopo: revisão da árvore integral da branch LG anterior (feature/lg-webos-catalog-fixes-v041), da arquitetura comum, dos empacotadores, dos manifestos, dos testes e dos pipelines. **Uma análise de fonte e testes automatizados não certificam a execução em Smart TVs físicas.**

## Situação do repositório

A main contém somente README.md. O aplicativo operacional ainda está em branches de desenvolvimento, desde feature/tv-first-prototype até feature/lg-webos-catalog-fixes-v041. Esta entrega usa a nova branch feature/lg-webos-audit-performance-v050, mantendo a main intacta até o usuário avaliar.

## Componentes inspecionados

| Componente | Arquivos/áreas | Situação |
| --- | --- | --- |
| Interface comum | src/main.mjs, src/style.css, src/core | Menu, player, M3U, XMLTV, favoritos, histórico, PIN e cache local implementados |
| LG webOS | apps/lg-webos, módulos lg-*, workflow webos-tv, Playwright LG | Funciona como prévia no Simulator 26; ainda exige testes em TV real |
| Android TV | MainActivity, PlayerActivity, Manifest, Gradle, Media3, Android CI | APK debug e player Media3, limite de 16 MB por resposta da ponte de rede |
| Samsung Tizen | config.xml, tizen-player, pacote de desenvolvimento | AVPlay experimental; sem assinatura WGT nem certificação de aparelho |
| VIDAA | README de pré-requisitos | Falta acesso/parceria oficial para SDK, testes e loja |
| Testes e build | 4 workflows, Node tests, Playwright, scripts Node/Python | Exercitam lógica e layout; não validam codecs físicos |
| Documentação | README, CHANGELOG, docs de arquitetura e testes | Parte da documentação ainda descreve 0.2.0 e precisa ser consolidada |

## Melhorias implementadas — LG 0.5.0

1. **Catálogo indexado**: agrupamentos de canais, gêneros/plataformas e séries são calculados uma vez por catálogo e reutilizados ao navegar. A troca real da lista e o desbloqueio parental invalidam a seleção derivada.
2. **EPG indexado por canal**: evita varrer todo o XMLTV quando se seleciona outra transmissão. Os resultados preservam horários e nomes do guia fornecido.
3. **Associação cuidadosa de EPG**: sufixos técnicos como HD, FHD, H265 e ALT podem ser removidos para verificar uma correspondência exata e única com o XMLTV. Não há aproximação por nome que escolha canais aleatórios.
4. **Atualização sem regravação desnecessária**: o merge LG distingue itens adicionados e alterações reais de metadados. Se não houver novidades, não regrava o catálogo monolítico no IndexedDB.
5. **URLs duplicadas**: a importação passa a contar e ignorar URLs repetidas. Catálogos antigos são limpos na abertura sem alterar URLs de favoritos e retomadas.
6. **Menos memória na leitura de M3U**: a leitura percorre o texto diretamente, sem construir uma segunda lista completa de linhas.
7. **Home e controle parental**: os totais mostrados não revelam quantidades de conteúdos restritos enquanto bloqueados; o singular “1 item” foi corrigido.
8. **Regressão**: testes adicionais cobrem 12.000 canais/episódios, caches de indexação, deduplicação, zero alterações no merge e EPG com sufixos técnicos.

Estas mudanças foram aplicadas ao fluxo LG webOS. Android TV e Tizen continuam com seus comportamentos de interface anteriores. O catálogo não inventa plataformas, gêneros, jogos nem placares ausentes nas fontes.

## Riscos e limitações ainda existentes

- **Catálogos 100 mil–300 mil+**: ainda são carregados inteiros em memória. Apesar de evitar gravação sem alterações, a estrutura de persistência é um registro inteiro por playlist: se algo muda, o registro todo é gravado. A verdadeira persistência incremental por item exige migração transacional de schema.
- **XMLTV**: o parser tem limite de aproximadamente 12 milhões de caracteres. XMLTV.gz, EPG de múltiplos dias e atualização incremental precisam de desenvolvimento e validação.
- **Metadados ambíguos**: nem sempre a playlist informa serviço ou gênero. A seção Sem classificação preserva itens sem atribuir classificações falsas.
- **Credenciais de playlists**: URLs podem incluir usuário/senha e são mantidas no estado do app; ainda não existe cofre nativo criptografado. Não as enviar em prints, logs nem CI.
- **Playback LG**: vídeo HTML5, codecs, DRM, legendas/áudio e formatos HLS/TS precisam de testes em hardware; o Simulator não é equivalente a uma TV física.
- **Navegação longa**: as colunas têm busca e paginação no DOM, mas não contam ainda com virtualização completa para centenas de milhares de itens.
- **Consolidação**: a main permanece apenas com documentação; mesclar a cadeia de PRs deve ser uma decisão separada depois dos testes.

## Procedimento de verificação

- npm run check: verifica sintaxe dos módulos.
- npm test: testes de parser, EPG, playlist, parental, controle remoto e desempenho lógico por índices.
- npx playwright test --config playwright.lg.config.mjs: testa a pasta empacotada dist/lg-webos no Chromium, 1280 × 720.
- GitHub Actions, Build LG webOS developer IPK: publica aurora-iptv-tv-lg-simulator-folder, relatório visual e IPK de desenvolvimento quando aprovado.

Para testar, abra a execução verde do workflow para feature/lg-webos-audit-performance-v050, extraia o artefato aurora-iptv-tv-lg-simulator-folder e abra **a pasta contendo appinfo.json** no Simulator 26. Teste Ao Vivo → Canal → EPG; Filmes → Gênero → Plataforma; Séries → Plataforma → Série → Episódios; favoritos, retorno e a migração sem duplicatas.

**Próxima evolução recomendada:** migrar o IndexedDB para store indexada por itens/URL e gravação transacional dos deltas, seguida por validação de reprodução em TV LG real.
