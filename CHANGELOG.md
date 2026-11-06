# Registro de alterações — AURORA IPTV TV

## 0.5.1 — LG webOS: catálogo organizado por fontes da M3U

- **Canal [24H]:** transmissões lineares com o marcador explícito [24H] deixam de aparecer como episódios e passam para Ao Vivo, mesmo quando o grupo do provedor é chamado "Séries".
- **Plataformas x grupos:** reconhece nomes decorados como ♦ Netflix e ✦ Crunchyroll. Onde falta plataforma confiável, usa a categoria real de \`group-title\` como "Categoria da lista: Esportes", "Categoria da lista: Doramas", sem atribuir uma plataforma fictícia.
- **Séries:** melhora o agrupamento de títulos com \`S01E01\`, \`S01 E02\`, \`1x03\` ou \`T01 Episódio 04\`, preservando programas distintos. Episódios com temporadas identificáveis agora exibem separadores de temporada.
- **Migração:** os itens já existentes no IndexedDB são reclassificados ao abrir o aplicativo; playlists, URLs, favoritos, retomada e PIN permanecem no armazenamento atual.
- **Interface LG:** rótulos da primeira coluna informam quando os grupos vêm diretamente da M3U. As telas Ao Vivo, Filmes e Séries continuam com três colunas.
- **Testes:** casos com canais [24H], coleções Netflix decoradas, agrupamento por série, fallback de grupos de origem e restauração do catálogo após fechar/abrir o Simulator.

Observação: informações que a M3U realmente não fornece não podem ser inventadas. Para avaliar a origem de entradas ambíguas, use a seção Sem classificação e os contadores em Configurações.



## 0.5.0 — LG webOS: revisão técnica e desempenho (05/11/2026)

- Análise das plataformas e testes documentada em docs/auditoria-tv-2026-11-05.md.
- Cache de índices dos conteúdos de Ao Vivo, Filmes e Séries e EPG por canal para reduzir trabalho repetido a cada seleção.
- Leitura M3U com menor alocação temporária; controle de URLs duplicadas na importação e migração de caches antigos.
- Atualização diária LG detecta quando houve mudança efetiva de metadados: sem novidades, não regrava o catálogo no IndexedDB.
- Correspondência segura do EPG para canais identificados com HD, FHD, H265 e ALT, apenas quando única.
- Contadores da Home respeitam o bloqueio parental; correção de pluralização.
- Testes para 12 mil itens, fontes EPG, favoritos, duplicatas, controles parentais e interface LG.
- Sem mudanças visuais/funcionais intencionais em Android TV, Tizen e VIDAA. Ainda requer validação física e importação em fluxo para catálogos muito grandes.


## 0.2.0 — Prévia de desenvolvimento

- Estrutura multiplataforma e interface TV-first com menu SVG e foco por controle remoto.
- Parser M3U, categorias conservadoras, séries agrupadas, playlists múltiplas, favoritos e retomada.
- Leitura XMLTV e programação atual/próxima; futebol identificado pelo EPG sem horários nem placares fictícios.
- Controle parental por PIN PBKDF2; conteúdo adulto oculto enquanto bloqueado.
- Atualizações diárias com preservação dos dados anteriores, incluindo tentativas de EPG.
- Armazenamento de catálogos e guias em IndexedDB, com migração da prévia baseada em localStorage.
- Android TV: projeto APK com Media3/ExoPlayer, WebView local e ponte de rede.
- Samsung: adaptador inicial AVPlay, com preparação assíncrona e controles de TV (ainda não certificado).
- LG webOS: geração do pacote IPK de desenvolvimento com SDK oficial.
- Verificações unitárias e de interface (Playwright) no GitHub Actions.

### Não concluído

- Testes de reprodução e controle em Smart TVs reais; certificado WGT da Samsung e acesso oficial VIDAA.
- Player TV com seleção completa de legendas/áudios e compatibilidade ampla com codecs.
- Importação em fluxo de playlists gigantes, XMLTV.gz multiplataforma, 20 idiomas completos, transmissão esportiva com resultados licenciados.
- Segurança de credenciais em armazenamento nativo, assinatura de produção e publicação em lojas.

## 0.1.0 — Protótipo inicial

- Repositório, documentação e visual Aurora TV, navegação básica e reprodução HTML5 de amostra livre.
