# AURORA IPTV TV

Aplicativo de IPTV para televisores, independente dos clientes Android e Desktop do ecossistema AURORA.

## Plataformas

- Android TV / Google TV — adaptação e Media3 na fase nativa.
- Samsung Tizen — pacote web para TV, com player AVPlay em etapa própria.
- LG webOS — pacote web, com adaptador próprio do player.
- Hisense VIDAA — viabilidade e distribuição condicionadas ao acesso às ferramentas e aprovação do fabricante.

**O aplicativo não fornece listas, canais ou conteúdo protegido.** As playlists são de responsabilidade do usuário.

## Status

🚧 Versão inicial de desenvolvimento. Este repositório começa com documentação e um protótipo de interface TV-first. Nenhuma plataforma é considerada validada em hardware real até passar pelos testes correspondentes.

## Objetivos iniciais

Navegação por controle remoto, foco visível, layout de 10 pés, playlist M3U, categorias conservadoras, favoritos persistentes e player de demonstração. Funcionalidades e pacotes nativos serão implementados gradualmente.

## Execução local

Após a chegada dos arquivos do protótipo, na raiz do repositório, execute `python -m http.server 8080` (Windows) ou `python3 -m http.server 8080` (Linux) e abra `http://localhost:8080`. As teclas de seta, Enter, Esc e Backspace simulam o controle remoto.

## Licença e distribuição

A publicação nas lojas depende das regras dos respectivos fabricantes. O código-fonte não carrega chaves, senhas ou playlists privadas.
