# AURORA IPTV TV — roteiro curto de testes

**Antes:** não compartilhe URLs de playlists que contenham usuário e senha. Priorize mídias autorizadas.

## A. PC (sem precisar de Smart TV)

1. Entre na branch feature/tv-first-prototype do GitHub e siga o README para abrir no navegador.
2. Na tela inicial, use as quatro setas, Enter e Escape; confirme se o foco fica sempre visível.
3. Redimensione a janela ou use modo 1280×720 / 1920×1080; confira se cards não se sobrepõem.
4. Clique em Testar vídeo livre; confira Play/Pause, Voltar e retorno à mesma tela.
5. Cadastre um M3U de teste em Configurações. Feche e reabra o navegador para validar persistência.
6. Confirme que Ao Vivo contém só canais, Filmes só filmes, e Séries mostra um card por título.
7. Cadastre um XMLTV permitido; confira Agora/A seguir no Ao Vivo e confrontos reais no Futebol.
8. Ative PIN parental. Confirme que +18 permanece oculto após fechar/reabrir o navegador.
9. Teste com mouse e controle por teclado; alterne tema claro e escuro.

## B. Android TV / Google TV

1. Acesse GitHub Actions → Build Android TV developer APK. Só faça o teste se o workflow estiver verde e tiver um APK no artefato.
2. Instale o APK debug por Android Studio/ADB ou método oficial de desenvolvedor da TV.
3. Verifique tela inicial, D-pad, botão Voltar, vídeo livre e se o Media3 abre e fecha sem travar.
4. Teste uma playlist pequena e autorizada, verificando HLS, cache local, favoritos e retomada.
5. Observe qualquer erro de imagem, codec ou som e registre marca/modelo, sistema e versão.

## C. LG webOS

1. Acesse GitHub Actions → Build LG webOS developer IPK, desde que o workflow esteja verde.
2. Utilize o processo oficial de Developer Mode e a ferramenta ares-install. Não altere firmware nem use sideload não oficial.
3. Verifique menu, ponteiro Magic Remote quando houver, foco, Voltar e reprodução suportada.

## D. Samsung Tizen e VIDAA

Samsung exige Tizen Studio + certificado de distribuição e WGT assinado antes de instalar. O adaptador AVPlay ainda precisa de validação.
VIDAA depende de acesso e ferramentas oficiais de desenvolvimento; não há pacote pronto para instalar.

## O que anotar caso encontre defeito

- Plataforma e modelo da TV; versão do sistema.
- Tela e sequência das teclas que reproduzem o problema.
- Tipo da mídia (HLS, TS, MP4, DASH), sem publicar URLs privadas.
- Mensagem de erro, print e comportamento esperado.

**Não informe que a plataforma está validada apenas porque o pacote foi gerado com sucesso.**
