# Validação de aceitação — Markdown para EPUB

- Entrada: `/Users/alinesouza/Documents/TI/Projetos/temporario/Capitulos_Revisados`
- Arquivos Markdown: 481, numerados de 1 a 481, sem lacunas, duplicatas ou vazios.
- EPUB: `../output/capitulos-revisados.epub` (481 XHTML de capítulos).
- NAV, NCX e spine: 481 referências cada, na ordem numérica, sem links internos quebrados.
- Comparação independente de texto: 481 Markdown analisados por `markdown-it-py`/BeautifulSoup contra os XHTML extraídos do EPUB; 0 divergências após normalizar espaços em branco. O teste preservou os sinais `~` presentes em cinco capítulos.
- EPUBCheck oficial 5.4.0: 0 erros fatais, 0 erros, 0 advertências, 0 informações. Detalhes e hashes por capítulo em `validation.json`.
- Testes do módulo: 5 aprovados, incluindo integração com EPUBCheck e bloqueio de publicação em falha.
- Regressão: `epub-structuring` 155/155 testes aprovados; `test:audit` 21 aprovados, 2 TODO.
- `npm test` da raiz permanece com falhas de descoberta porque Jest tenta executar suítes `node:test` de outros workflows; não é um gate confiável para este módulo.

Metadados da edição de aceitação: título “Capítulos Revisados” e autor “Autor não informado”, pois estes dados não estavam no pedido nem nos nomes dos arquivos. O comando aceita ambos explicitamente para gerar uma edição com metadados definitivos.
