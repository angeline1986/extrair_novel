# Validação de aceitação — Markdown para EPUB

- Entrada: `/Users/alinesouza/Documents/TI/Projetos/temporario/Capitulos_Revisados`
- Arquivos Markdown: 481, numerados de 1 a 481, sem lacunas, duplicatas ou vazios.
- EPUB: `../output/O Tirano que se Ajoelhou por Mim - Yi Jian.epub` (481 XHTML de capítulos, página de capa e imagem de capa).
- NAV e NCX: 481 referências cada. O spine contém a capa seguida dos 481 capítulos em ordem numérica, sem links internos quebrados.
- Comparação independente de texto: 481 Markdown analisados por `markdown-it-py`/BeautifulSoup contra os XHTML extraídos do EPUB; 0 divergências após normalizar espaços em branco. O teste preservou os sinais `~` presentes em cinco capítulos.
- EPUBCheck oficial 5.4.0: 0 erros fatais, 0 erros, 0 advertências, 0 informações. Detalhes e hashes por capítulo em `validation.json`.
- Testes do módulo: 5 aprovados, incluindo integração com EPUBCheck e bloqueio de publicação em falha.
- Regressão: `epub-structuring` 155/155 testes aprovados; `test:audit` 21 aprovados, 2 TODO.
- Menu: `npm start` abriu o menu; a opção 5 detectou a pasta, recuperou os metadados e gerou o EPUB com a capa sem redigitar os campos.
- `npm test` da raiz permanece com falhas de descoberta porque Jest tenta executar suítes `node:test` de outros workflows; não é um gate confiável para este módulo.

Metadados da edição de aceitação: título “O Tirano que se Ajoelhou por Mim”, autor “Yi Jian Sheng Cai Miao”, idioma `pt-BR` e capa `Capa.jpg`, conforme informado no menu.
