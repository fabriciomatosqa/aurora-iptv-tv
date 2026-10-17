# AURORA IPTV TV — Prévia 0.2.0

Aplicativo independente de IPTV para Smart TVs; sem canais, playlists ou credenciais incluídos.

## Recursos implementados na prévia

- TV-first, ícones vetoriais, navegação D-pad, modo claro/escuro.
- Múltiplas playlists M3U, troca de listas, busca, favoritos e retomada de VOD.
- Separação conservadora de canais, filmes, séries e episódios agrupados.
- EPG/XMLTV manual, programação atual e confrontos de futebol identificados no guia, sem resultados fictícios.
- PIN parental com PBKDF2 e conteúdo +18 oculto até desbloqueio.
- Uma tentativa de atualização automática de playlist por dia.
- Projeto Android TV com player Media3 e ponte de rede; montagem de APK no GitHub Actions.
- Pacote LG webOS de desenvolvimento via CLI oficial e preparação Samsung Tizen.

## Testar no computador

```sh
git clone -b feature/tv-first-prototype https://github.com/fabriciomatosqa/aurora-iptv-tv.git
cd aurora-iptv-tv
python3 -m http.server 8080
```

No Windows, substitua python3 por python. Depois abra http://localhost:8080. Use setas, Enter e Esc.
Em Configurações, cole um M3U autorizado ou URL com CORS habilitado. Há um vídeo livre de teste.

## Verificações

```sh
npm run check
npm test
npm run package:tv
npm install
npx playwright install chromium
npm run test:ui
```

GitHub Actions → Build Android TV developer APK → Artifacts → aurora-iptv-tv-android-debug-apk (somente se o build tiver sucesso).
GitHub Actions → Build LG webOS developer IPK → Artifacts → aurora-iptv-tv-lg-webos-dev-ipk (somente se o build tiver sucesso).
Samsung exige um certificado Tizen válido para gerar WGT instalável. VIDAA depende de acesso autorizado ao SDK.

## Limites atuais

Compilar não equivale a testar numa TV real. O protótipo usa localStorage (inadequado para listas gigantes ou segredos em computadores compartilhados).
A ponte Android possui limite preliminar de 16 MB por resposta. DRM, compatibilidade de codecs, outros idiomas completos e players de Tizen/VIDAA ainda precisam ser desenvolvidos/validados.
Ícones da versão de desenvolvimento webOS são provisórios e serão substituídos pelo branding Aurora oficial.

Consulte docs/testing.md, docs/architecture.md e apps/*/README.md para as diferenças de plataforma.
