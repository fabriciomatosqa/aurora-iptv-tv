# Registro de alterações — AURORA IPTV TV

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
