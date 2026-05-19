// src/reportWriter/dashboard/technicalSections.js
// Seções recolhíveis com dados diagnósticos complementares.

import {
  escapeHtml,
  formatNumber,
  renderDetailPanel,
  statusBadge,
} from './htmlUtils.js';

function previewParagraphs(doc) {
  const paragraphs = (doc?.paragraphs || []).filter((paragraph) => paragraph?.trim()).slice(0, 3);

  if (!paragraphs.length) return '<div class="small">Sem prévia de parágrafos disponível.</div>';

  return paragraphs.map((paragraph, index) => `
    <div class="example">
      <div class="small">Parágrafo ${index + 1}</div>
      <pre>${escapeHtml(paragraph.slice(0, 500))}${paragraph.length > 500 ? '...' : ''}</pre>
    </div>`).join('');
}

export function renderDocumentPreviews(sourceDocs = [], translatedDocs = []) {
  if (!sourceDocs.length && !translatedDocs.length) return '';

  const sourceByName = new Map(sourceDocs.map((doc) => [doc.filename, doc]));
  const translatedByName = new Map(translatedDocs.map((doc) => [doc.filename, doc]));
  const filenames = [...new Set([...sourceByName.keys(), ...translatedByName.keys()])];

  return `
    <section>
      <div class="section-title">
        <div>
          <h2>Prévia dos documentos</h2>
          <p>Primeiros parágrafos para confirmar rapidamente se os arquivos auditados são os esperados.</p>
        </div>
      </div>

      <details>
        <summary>Ver prévia do original e da tradução</summary>
        <div class="card">
          <div class="grid grid-2">
            ${filenames.map((filename) => {
              const source = sourceByName.get(filename);
              const translated = translatedByName.get(filename);

              return `
                <div>
                  <h3>${escapeHtml(filename)}</h3>
                  <div class="small">Original</div>
                  <div class="examples">${previewParagraphs(source)}</div>
                </div>
                <div>
                  <h3>${escapeHtml(translated?.filename || filename)}</h3>
                  <div class="small">Tradução</div>
                  <div class="examples">${previewParagraphs(translated)}</div>
                </div>`;
            }).join('')}
          </div>
        </div>
      </details>
    </section>`;
}

function renderFilesTable(files = []) {
  if (!files.length) return '';

  return `
    <table>
      <thead>
        <tr>
          <th>Arquivo</th>
          <th>Status</th>
          <th>Chars</th>
          <th>Parágrafos</th>
          <th>Capítulos</th>
        </tr>
      </thead>
      <tbody>
        ${files.map((file) => `
          <tr>
            <td>
              <strong>${escapeHtml(file.filename)}</strong>
              <div class="small">${escapeHtml(file.translationFilename || 'sem tradução pareada')}</div>
            </td>
            <td>${statusBadge(file.severity || (file.alignment === 'matched' ? 'OK' : 'FAIL'), file.alignment || 'N/A')}</td>
            <td>${formatNumber(file.sourceChars)} -> ${formatNumber(file.translationChars || 0)}</td>
            <td>${formatNumber(file.sourceParagraphs)} -> ${formatNumber(file.translationParagraphs || 0)}</td>
            <td>${formatNumber(file.matchedChapters || 0)}/${formatNumber(file.chapterCount || 0)} pareados</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

function getProblematicChapters(alignedDocs = [], ollamaResults = []) {
  const ollamaMap = new Map();
  for (const result of ollamaResults) {
    const key = `${result.sourceTitle || ''}|${result.translationTitle || ''}`;
    ollamaMap.set(key, result);
  }

  const rows = [];

  for (const doc of alignedDocs) {
    if (doc.alignment === 'missing') {
      rows.push({
        file: doc.source?.filename || 'arquivo desconhecido',
        chapter: 'Arquivo inteiro',
        status: 'FAIL',
        reason: 'Arquivo traduzido ausente.',
        raw: doc,
      });
      continue;
    }

    for (const chapter of doc.chapters || []) {
      const key = `${chapter.sourceTitle || ''}|${chapter.translationTitle || ''}`;
      const ollama = ollamaMap.get(key);
      const sizeRatio = chapter.translationCharCount / Math.max(chapter.sourceCharCount || 0, 1);
      const paraRatio = chapter.translationParagraphs / Math.max(chapter.sourceParagraphs || 0, 1);
      const reasons = [];

      if (chapter.matchType !== 'matched') reasons.push(`matchType: ${chapter.matchType}`);
      if (chapter.confidence !== undefined && chapter.confidence < 0.5) reasons.push(`baixa confiança (${Math.round(chapter.confidence * 100)}%)`);
      if (sizeRatio < 0.5) reasons.push(`tamanho reduzido (${Math.round(sizeRatio * 100)}%)`);
      if (sizeRatio > 1.5) reasons.push(`tamanho aumentado (${Math.round(sizeRatio * 100)}%)`);
      if (paraRatio < 0.5) reasons.push(`poucos parágrafos (${Math.round(paraRatio * 100)}%)`);
      if (ollama?.review?.status === 'fail') reasons.push(`IA: ${ollama.review.problem || 'perda de sentido'}`);
      if (ollama?.review?.status === 'warning') reasons.push(`IA: ${ollama.review.problem || 'possível problema'}`);

      if (!reasons.length) continue;

      rows.push({
        file: doc.source?.filename || doc.translation?.filename || 'arquivo desconhecido',
        chapter: chapter.sourceTitle || chapter.translationTitle || `Capítulo ${Number(chapter.sourceIndex || 0) + 1}`,
        status: ollama?.review?.status === 'fail' || chapter.matchType === 'missing' ? 'FAIL' : 'WARN',
        reason: reasons.join('; '),
        raw: { chapter, ollama },
      });
    }
  }

  return rows;
}

export function renderProblematicChapters(alignedDocs = [], ollamaResults = []) {
  const rows = getProblematicChapters(alignedDocs, ollamaResults);
  const ollamaRows = (ollamaResults || []).filter((result) => result.review?.status);

  return `
    <section>
      <div class="section-title">
        <div>
          <h2>Arquivos e capítulos</h2>
          <p>Inventário por arquivo, capítulos problemáticos e resultados de IA quando houver.</p>
        </div>
      </div>

      <details>
        <summary>Ver arquivos auditados e capítulos problemáticos</summary>
        <div class="card">
          ${rows.length ? `
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Arquivo</th>
                  <th>Capítulo</th>
                  <th>Motivo</th>
                </tr>
              </thead>
              <tbody>
                ${rows.map((row, index) => `
                  <tr class="expandable-row" data-detail="chapter-${index}">
                    <td>${statusBadge(row.status)}</td>
                    <td>${escapeHtml(row.file)}</td>
                    <td><button class="row-toggle" type="button" aria-expanded="false">+</button>${escapeHtml(row.chapter)}</td>
                    <td>${escapeHtml(row.reason)}</td>
                  </tr>
                  <tr class="detail-row" id="chapter-${index}">
                    <td colspan="4">${renderDetailPanel({
                      title: row.chapter,
                      status: row.status,
                      evidence: [row.reason],
                      interpretation: 'Este capítulo entrou na lista por alinhamento, tamanho, quantidade de parágrafos ou revisão de IA.',
                      actions: [
                        'Comparar o capítulo original e traduzido antes de corrigir automaticamente.',
                        'Se for problema de alinhamento, revisar a divisão de capítulos.',
                        'Se for perda de sentido, revisar manualmente a tradução deste trecho.',
                      ],
                      raw: row.raw,
                    })}</td>
                  </tr>`).join('')}
              </tbody>
            </table>` : '<div class="small">Nenhum capítulo problemático detectado nesta execução.</div>'}

          ${ollamaRows.length ? `
            <h3 style="margin-top:18px">Revisões de IA</h3>
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Original</th>
                  <th>Tradução</th>
                  <th>Problema</th>
                </tr>
              </thead>
              <tbody>
                ${ollamaRows.map((result) => `
                  <tr>
                    <td>${statusBadge(result.review?.status || 'INFO')}</td>
                    <td>${escapeHtml(result.sourceTitle || 'sem título')}</td>
                    <td>${escapeHtml(result.translationTitle || 'sem título')}</td>
                    <td>${escapeHtml(result.review?.problem || result.review?.suggestion || 'sem detalhe')}</td>
                  </tr>`).join('')}
              </tbody>
            </table>` : ''}
        </div>
      </details>
    </section>`;
}

export function renderFileInventory(files = []) {
  if (!files.length) return '';

  return `
    <section>
      <div class="section-title">
        <div>
          <h2>Inventário de arquivos</h2>
          <p>Resumo de pareamento, tamanho e capítulos por arquivo auditado.</p>
        </div>
      </div>

      <details>
        <summary>Ver inventário de arquivos</summary>
        <div class="card">${renderFilesTable(files)}</div>
      </details>
    </section>`;
}

export function renderTechnicalTrace(report) {
  const trace = report.workflowTrace;
  const workflow = report.versionWorkflow;
  if (!trace && !workflow) return '';

  return `
    <section>
      <div class="section-title">
        <div>
          <h2>Rastro técnico da execução</h2>
          <p>Eventos de versionamento e decisões usadas para montar o relatório.</p>
        </div>
      </div>

      <details>
        <summary>Ver versionamento, escritas e dados técnicos</summary>
        <div class="card">
          ${renderDetailPanel({
            title: 'Workflow',
            status: trace?.warnings?.length ? 'WARN' : 'INFO',
            evidence: [
              `Versão atual: ${trace?.currentStep ? `v${trace.currentStep}` : 'desconhecida'}.`,
              `Versões encontradas: ${(trace?.versionsFound || []).join(', ') || 'nenhuma'}.`,
              `Versões criadas: ${(trace?.versionsCreated || []).join(', ') || 'nenhuma'}.`,
              `Versões ausentes: ${(trace?.versionsMissing || []).join(', ') || 'nenhuma'}.`,
            ],
            interpretation: 'Use este bloco quando o resultado parecer ter usado a origem errada ou quando houver dúvida sobre sobrescrita de versão.',
            actions: [
              'Se a origem auditada estiver errada, revisar working input/current antes da próxima auditoria.',
              'Se houver sobrescrita inesperada, conferir os eventos FILE_WRITE.',
            ],
            raw: { versionWorkflow: workflow, workflowTrace: trace },
          })}
        </div>
      </details>
    </section>`;
}
