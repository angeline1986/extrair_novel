# Markdown para EPUB 3.0

Converte capítulos `capitulo_N_traducao_revisada.md` ou `capitulo_N_traducao_validada.md` (com ou sem zeros à esquerda) em um EPUB 3.0. Os arquivos de entrada são somente lidos. Números repetidos, lacunas, arquivos vazios e títulos incompatíveis bloqueiam a geração.

## Uso

Execute `npm start` e escolha **5. Markdown para EPUB**. O menu detecta pastas com capítulos em `workflows/markdown-to-epub/input/` e em `../temporario/`, mostra os dados do livro e guarda as escolhas em `state/last-used.json` para as próximas conversões. Pressione Enter para gerar ou `e` para editar título, autor, idioma, capa e saída. Um nome de saída simples é salvo em `output/` com a extensão `.epub` acrescentada automaticamente. Caminhos iniciados por `~` também são aceitos.

Para uso direto pela linha de comando:

```sh
npm install
npm run build:markdown-epub -- \
  --input /caminho/Capitulos_Revisados \
  --title "Título da obra" \
  --author "Nome do autor" \
  --language pt-BR \
  --cover /caminho/capa.jpg \
  --output workflows/markdown-to-epub/output/livro.epub \
  --report workflows/markdown-to-epub/reports/validation.json \
  --epubcheck /caminho/epubcheck.jar
```

`--cover`, `--output`, `--report` e `--epubcheck` são opcionais. Para EPUBCheck, informe `--epubcheck`, defina `EPUBCHECK_JAR`, instale o comando `epubcheck` no PATH ou extraia a distribuição oficial em `tools/epubcheck-5.4.0/`. Ela está em [w3c/epubcheck](https://github.com/w3c/epubcheck/releases). O ZIP inclui o JAR e a pasta `lib`; mantenha-os juntos. A publicação do EPUB depende de validação interna e de EPUBCheck com código de saída zero.

Saída padrão na CLI: `workflows/markdown-to-epub/output/markdown.epub`; nomes simples passados a `--output` também vão para essa pasta. Relatório padrão: `workflows/markdown-to-epub/reports/validation.json`. O relatório contém a lista ordenada, títulos, hashes SHA-256 dos arquivos de origem e do texto extraído dos XHTML, contagens de NAV/NCX/spine e a saída do EPUBCheck. O arquivo EPUB só substitui a saída final após todas as verificações passarem.

Para executar os testes: `npm run test:markdown-epub`. O teste de integração com EPUBCheck oficial roda quando `EPUBCHECK_JAR` aponta para o JAR da distribuição.
