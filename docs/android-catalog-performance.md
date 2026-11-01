# Catálogos grandes no APK Android TV / Google TV

Base: sequência dos PRs #1–#5, head `6b9ef0ea16fd8b3fd414132a1a3e4b0ae08dd746`.
A main contém uma versão menos desenvolvida. Esta alteração deve ser revisada
sobre a branch do PR #5, sem integrar automaticamente essa sequência à main.
O smartphone tem implementação e resultados independentes na PR
https://github.com/fabriciomatosqa/iptv-player/pull/45.

## Gargalos encontrados

O IndexedDB guardava cada playlist como um único array. `hydrateCatalogs` lia
todas as playlists e guias, e a interface filtrava/agrupava os arrays completos.
O importador Android transferia a resposta para uma string Java/JavaScript com
limite de 16 MB. A interface não LG exibia somente os primeiros 180 cards,
sem paginação real do armazenamento. A atualização remota repetia essas cópias
e o processamento na thread da interface.

## Implementação específica do Android

O bridge anuncia a capacidade `catalogVersion=1`. Só o APK Android que fornece
essa capacidade usa o novo caminho. Navegador, webOS e Tizen mantêm seus caminhos.

- SQLite/WAL com itens individuais, índices por playlist/tipo/categoria/série,
  resumo persistido e diretório de séries sem arrays de episódios.
- Resumo somente da playlist ativa na abertura; primeiras páginas de até 48
  itens, uma sentinela para a próxima página, categorias paginadas e temporadas
  consultadas quando uma série é aberta. A tela conserva uma janela de itens.
- Busca no armazenamento, com espera curta de digitação e cancelamento de
  consultas obsoletas. Categorias e séries não dependem do limite antigo de 180.
- Download HTTP em fluxo para arquivo temporário, parser Java com buffers e
  limite por linha, importador dedicado fora da interface. O limite antigo de
  16 MB não se aplica ao download do catálogo. Falta de espaço/rede/parser
  interrompe a importação sem substituir o catálogo confirmado.
- ETag/Last-Modified/304 e SHA-256 do corpo decodificado, gzip, validação de
  Content-Length em bytes transferidos e CRC/EOF. Corpo igual evita interpretação;
  comparação por URL evita regravar itens idênticos quando o corpo muda.
- Transação única não exclusiva: os leitores continuam vendo o catálogo anterior
  até o commit; contagens, grupos e séries mudam na mesma transação. Grupos/séries
  afetados são atualizados; itens que desapareceram da resposta são preservados.
- Guia local posterior à primeira página, playlists inativas somente ao selecionar.
  Futebol consulta os canais correspondentes ao guia por índices e lotes limitados,
  preservando correspondência exata e a prioridade de tvg-id.

Não se inferem identidades por título. URLs e chaves de favoritos/progresso/histórico
mantêm o contrato anterior da TV. Portanto uma URL inteiramente diferente ainda é
um item diferente, mesmo quando o título coincide. O diretório mantém a distinção
entre títulos acentuados que o agrupamento anterior tratava como distintos.
Em URLs já conhecidas, uma mudança de título de episódio conserva a identidade
original da série e a chave de favorito, mesmo quando o nome apresentado muda.
Uma série com episódios restritos continua bloqueada como conjunto.

## Migração e dados antigos

Só a playlist ativa lê seu array antigo uma vez. A conversão usa lotes de 256
para o escritor nativo, com confirmação transacional e retomada a partir do
catálogo original após uma falha. O IndexedDB anterior permanece como recuperação.
Não há exclusão de dados para migrar. Dados inline de playlists/guias inativos
só deixam o localStorage depois de sua própria gravação durável.

Durante essa primeira conversão, canais e filmes do array antigo já lido podem
ser navegados e reproduzidos. O fallback conserva uma página, cede a execução
entre blocos e mantém o array apenas enquanto necessário. Séries aguardam o
diretório completo, inclusive sua agregação de controle parental. A conversão
inicial ainda exige a leitura do valor monolítico antigo; o caminho normal após
o commit não o lê novamente. Não apresentar esse custo inicial como eliminado.

## Validação

`CatalogStoreTest`: anexos 15→17, diretório/episódios sob demanda, idempotência sem
escritas nos itens iguais, metadados por URL, rollback, leitura concorrente WAL,
migração interrompida, classificação/favoritos, títulos acentuados, controle
parental, busca/categoria, planos de consulta e HTTP gzip/304/truncamento.

`CatalogUiTest`: APK/WebView real, controle remoto, acesso além dos 180 antigos,
busca em toda a biblioteca, páginas limitadas, episódios, favoritos/progresso e
reabertura. Vídeo sintético real toca no Media3 antes de liberar uma atualização
HTTP deliberadamente retida. A fixture é gerada pelo CI, sem conteúdo de provedor.

`CatalogPerformanceTest`: matriz opt-in 10k/100k/300k/600k/1,2M, importação inicial,
resumo após reabrir, primeiras consultas, reabertura da WebView, páginas visíveis,
sem mudanças, dois episódios, CPU/PSS amostrado e banco+WAL. Microbenchmark do
antigo `loadCatalog`+`groupSeries` na WebView real em 10k/100k; não se repete acima
de 100k porque o método materializa o array completo. Não é uma comparação de
duas versões inteiras do APK nem autoriza extrapolar fatores de aceleração.

O workflow Android TV acrescenta lint, compilação de testes e emulador **Android
TV API34 x86**, cuja imagem foi confirmada no catálogo oficial do SDK. Depois da
matriz, mata e reabre o processo com 1.200.002 itens; registra separadamente o
tempo `am start -W` e a observação do conteúdo, que inclui a demora da captura
de acessibilidade. Os testes gerais e visuais existentes continuam ativos.
Evidências ficam no artefato `aurora-android-tv-catalog-verification`.

Resultados do candidato devem ser vinculados à execução e ao commit na PR.
Compilação local e testes Node não substituem essa rodada do emulador.

## Limites e distribuição

Uma medição por tamanho não dá intervalo de confiança. PSS amostrado não é pico,
não soma de forma exata a memória de todos os processos da WebView. Reabertura
de WebView não é partida a frio do processo. Vídeo/rede são provas separadas,
não tempo de reprodução em cada tamanho. Não há TV física ou benchmark controlado
dos concorrentes. O guia continua com seu limite e parser existentes; seu
carregamento foi adiado, mas não foi criado um banco nativo de XMLTV nesta alteração.

Um M3U alterado ainda exige download e comparação completos sem API de delta.
O atalho de prefixo do smartphone não foi transplantado sem validação para a TV.
Busca por substring e páginas muito profundas por OFFSET ainda têm custo
proporcional aos registros examinados; as primeiras páginas usam os índices.
O cache antigo é mantido, portanto a primeira conversão precisa de espaço para
as duas representações até uma política futura de retenção explicitamente aprovada.

applicationId `br.com.auroraiptv.tv`, versão 0.2.0/code2 e dados do app permanecem.
Este projeto não possui configuração de chave persistente equivalente à do
smartphone: seu CI já gerava APK de desenvolvimento com debug signing padrão.
A mudança não substitui nem exporta chaves. O artefato de teste não comprova
instalação sobre um APK anterior assinado por outra chave; é necessário usar a
chave original para uma distribuição compatível. Não recomendar desinstalação
ou limpeza de dados. Não houve publicação, alteração de versão nem push em main.
