# AURORA IPTV TV

Protótipo **0.1.0**, interface TV-first para navegadores, em desenvolvimento no ecossistema AURORA IPTV.

## Iniciar no PC (Windows/Linux)

```bash
# Na raiz do projeto
python -m http.server 8080
# ou Linux: python3 -m http.server 8080
```

Abra `http://localhost:8080/`. Controle com **setas**, **Enter**, **Esc/Backspace**. Também funciona com mouse. Clique em **Testar vídeo livre** para um vídeo de demonstração CC0. Em Configurações, adicione playlist M3U fornecida legalmente por você (URL com CORS habilitado ou texto M3U colado).

## Verificações

```bash
npm run check
npm test
npm run package:tv
```

O comando de empacotamento produz **pastas de desenvolvimento não assinadas**, em `dist/lg-webos` e `dist/samsung-tizen`, não pacotes instaláveis para Smart TV. Leia `docs/testing.md` e `docs/architecture.md` para os procedimentos e os limites.

## Compatibilidade planejada

| Sistema | Situação atual |
|---|---|
| Android TV / Google TV | Adapter nativo e Media3 ainda não implementados |
| Samsung Tizen | Shell web não testado; AVPlay pendente |
| LG webOS | Shell web não testado; player nativo pendente |
| Hisense VIDAA | Dependente do acesso oficial aos SDKs e políticas de distribuição |

## Recursos disponíveis nesta prévia

Layout responsivo 10-foot, ícones vetoriais, navegação inicial por D-pad, parse M3U, busca, múltiplas playlists e troca de listas, séries consolidadas, favoritos e retomada básica, streaming HTML5 quando o navegador suporta. Futebol e EPG ainda não integrados. Controle parental, traduções, atualização diária e cache persistente para grandes catálogos não fazem parte desta prévia.

## Privacidade

**Não inclui listas IPTV, assinaturas, conteúdos comerciais ou credenciais.** A prévia utiliza `localStorage` não criptografado e de pequena capacidade: não é apropriada para armazenar credenciais privadas em PCs públicos nem playlists enormes. Os produtos finais deverão usar armazenamento seguro e pipelines de dados adequados.

Documentação: `docs/architecture.md`, `docs/testing.md`, `apps/*/README.md`.
