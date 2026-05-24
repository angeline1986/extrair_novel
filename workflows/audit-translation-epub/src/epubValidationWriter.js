// Relatório de validação por abas (padrão audit-translation-docx).

import fs from 'fs';
import {
  validationTabScript,
  validationTabStyles,
} from '../../audit-translation-docx/src/reportWriter/validationTabsWriter.js';
import { getLatestJsonReportByWorkingInput } from '../../audit-translation-docx/src/reportWriter/dashboard/dataSources.js';
import { escapeHtml, formatNumber } from '../../audit-translation-docx/src/reportWriter/dashboard/htmlUtils.js';

function statusKind(status) {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'FAIL') return 'fail';
  if (normalized === 'WARN' || normalized === 'WARNING') return 'warn';
  return 'ok';
}

function statusIcon(status) {
  const kind = statusKind(status);
  if (kind === 'fail') return 'x';
  if (kind === 'warn') return '!';
  return 'ok';
}

function badge(status) {
  const kind = statusKind(status);
  return `<span class="status-badge ${kind}">${statusIcon(status)}</span>`;
}

function valueColor(status) {
  const kind = statusKind(status);
  if (kind === 'fail') return '#F44336';
  if (kind === 'warn') return '#FF9800';
  return '#4CAF50';
}

function summaryCard(label, value, status = null, style = '') {
  const color = status ? `color: ${valueColor(status)};` : '';
  return `
    <div class="summary-card">
      <div class="summary-card-label">${escapeHtml(label)}</div>
      <div class="summary-card-value" style="${color}${style}">${escapeHtml(String(value))}</div>
    </div>`;
}

function detailRow(label, value, status = null) {
  const color = status ? ` style="color: ${valueColor(status)};"` : '';
  return `
    <div class="detail-row">
      <span class="detail-label">${escapeHtml(label)}</span>
      <span class="detail-value"${color}>${escapeHtml(String(value))}</span>
    </div>`;
}

function actionList(title, actions) {
  return `
    <div class="action-list">
      <div class="action-list-title">${escapeHtml(title)}</div>
      <ul class="action-list-items">
        ${(actions || []).map((action) => `<li class="action-item">${escapeHtml(action)}</li>`).join('')}
      </ul>
    </div>`;
}

function validationSection(status, title, content) {
  return `
    <div class="validation-section">
      <div class="validation-title">
        ${badge(status)}
        ${escapeHtml(title)}
      </div>
      ${content}
    </div>`;
}

function detailsBlock(rows) {
  return `<div class="validation-details">${rows.join('')}</div>`;
}

function fileList(items, icon = 'file') {
  if (!items.length) {
    return '<div class="empty-state">Nenhum item registrado.</div>';
  }

  return `
    <ul class="file-list">
      ${items.map((item) => `
        <li class="file-item">
          <span class="file-icon">${escapeHtml(icon)}</span>
          <div class="file-info">
            <div class="file-name">${escapeHtml(item.name)}</div>
            <div class="file-meta">${escapeHtml(item.meta || '')}</div>
          </div>
        </li>`).join('')}
    </ul>`;
}

function wordsAroundMatch(context = '', match = '', radius = 6) {
  const text = String(context || '').replace(/\s+/g, ' ').trim();
  const needle = String(match || '').trim();
  if (!text || !needle) return { text: text || '-', match: needle, embedded: false, marked: text || '-' };

  const lowerText = text.toLocaleLowerCase();
  const lowerNeedle = needle.toLocaleLowerCase();
  const index = lowerText.indexOf(lowerNeedle);
  if (index < 0) return { text, match: needle, embedded: false, marked: text };

  const previousChar = index > 0 ? text[index - 1] : '';
  const embedded = Boolean(previousChar && /[\p{L}\p{N}]/u.test(previousChar));
  const marked = `${text.slice(0, index)}<<MATCH>>${text.slice(index, index + needle.length)}<</MATCH>>${text.slice(index + needle.length)}`;
  const tokens = marked.split(/\s+/);
  const matchTokenIndex = tokens.findIndex((token) => token.includes('<<MATCH>>'));
  const start = Math.max(0, matchTokenIndex - radius);
  const end = Math.min(tokens.length, matchTokenIndex + radius + 1);
  const clipped = `${start > 0 ? '... ' : ''}${tokens.slice(start, end).join(' ')}${end < tokens.length ? ' ...' : ''}`;

  return { text: clipped.replaceAll('<<MATCH>>', '').replaceAll('<</MATCH>>', ''), marked: clipped, embedded };
}

function highlightMarkedContext(marked = '') {
  return escapeHtml(marked || '-')
    .replaceAll('&lt;&lt;MATCH&gt;&gt;', '<strong class="problem-highlight">')
    .replaceAll('&lt;&lt;/MATCH&gt;&gt;', '</strong>');
}

function isEmbeddedGenderFalsePositive(issue, example) {
  return issue?.type === 'epub_gender_suspicion'
    && wordsAroundMatch(example?.context, example?.match).embedded;
}

function epubSuggestionForExample(issue, example) {
  const match = String(example?.match || '');
  const contextWindow = wordsAroundMatch(example?.context, match);

  if (issue?.type === 'epub_gender_suspicion') {
    if (contextWindow.embedded) {
      return 'Provável falso positivo: a ocorrência parece estar dentro de outra palavra.';
    }
    return 'Revisar concordância no trecho destacado antes de corrigir em massa.';
  }
  if (issue?.type === 'epub_possible_broken_sentence') {
    return 'Pode ser URL, nota ou abreviação. Validar amostra antes de tratar como quebra de frase.';
  }
  if (issue?.type === 'epub_residual_english' || issue?.type === 'residual_english') {
    return 'Confirmar se o trecho em inglês deve permanecer (nome próprio, termo técnico) ou traduzir.';
  }
  if (/^log_|translation_log/.test(issue?.type || '')) {
    return 'Conferir se o termo ou a troca declarada no log foi aplicada no EPUB.';
  }
  if (/^epub_(section|text_section|paragraph)|missing_sections|extra_sections/.test(issue?.type || '')) {
    return 'Revisar estrutura do EPUB e o pareamento de seções antes de publicar nova versão.';
  }

  return 'Revisar manualmente e decidir entre correção, exceção ou falso positivo.';
}

function issueExamplesTable(issue) {
  const originalExamples = (issue?.examples || []).slice(0, 8);
  const examples = originalExamples.filter((example) => !isEmbeddedGenderFalsePositive(issue, example));

  if (originalExamples.length && !examples.length) {
    return '<div class="empty-state">Todos os exemplos parecem falsos positivos (match embutido em outra palavra). Rode nova auditoria após ajustar o detector.</div>';
  }

  if (!examples.length) {
    return '<div class="empty-state">Sem exemplos registrados para esta validação.</div>';
  }

  return `
    <div class="details-content">
      <div class="example-title">Exemplos detectados</div>
      <table class="example-table">
        <thead>
          <tr>
            <th><input type="checkbox" class="master-checkbox" aria-label="Selecionar todos"></th>
            <th>Ocorrência</th>
            <th>Contexto</th>
            <th>Sugestão</th>
          </tr>
        </thead>
        <tbody>
          ${examples.map((example) => `
            <tr>
              <td class="example-checkbox"><input type="checkbox"></td>
              <td class="example-col">${escapeHtml(example.match || '-')}</td>
              <td class="example-col">${highlightMarkedContext(wordsAroundMatch(example.context, example.match).marked)}</td>
              <td class="example-col">${epubSuggestionForExample(issue, example)}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function getFileLabel(report) {
  return [
    report?.stats?.sourceFile,
    report?.stats?.translatedFile,
  ].filter(Boolean).join(' · ') || 'sem arquivo';
}

function getPairingPercent(report) {
  const sourceFiles = Number(report?.stats?.sourceFiles || 0);
  if (!sourceFiles) return '0%';
  return `${Math.round((Number(report?.stats?.matchedFiles || 0) / sourceFiles) * 100)}%`;
}

function isStructuralIssue(item) {
  return /^epub_(section|text_section|paragraph|translation)|missing_sections|extra_sections|missing_file|missing_translation/.test(item?.type || '');
}

function isPatternIssue(item) {
  return /^epub_(gender|possible|residual)/.test(item?.type || '');
}

function isLogIssue(item) {
  return /^log_|translation_log/.test(item?.type || '');
}

function getProblematicSections(report) {
  const chapters = report?.epubAudit?.alignment || report?.files?.[0]?.epub?.sections || [];
  const rows = [];

  for (const chapter of chapters) {
    const reasons = [];
    if (chapter.matchType !== 'matched') reasons.push(`match: ${chapter.matchType}`);
    if (chapter.confidence !== undefined && chapter.confidence < 0.5) {
      reasons.push(`baixa confiança (${Math.round(chapter.confidence * 100)}%)`);
    }
    const ratio = chapter.translationCharCount / Math.max(chapter.sourceCharCount || 0, 1);
    if (chapter.matchType === 'matched' && ratio < 0.5) {
      reasons.push(`tamanho reduzido (${Math.round(ratio * 100)}%)`);
    }
    if (chapter.matchType === 'matched' && ratio > 1.5) {
      reasons.push(`tamanho aumentado (${Math.round(ratio * 100)}%)`);
    }
    if (!reasons.length) continue;

    rows.push({
      chapter: chapter.sourceTitle || chapter.translationTitle || `Seção ${Number(chapter.sourceIndex || 0) + 1}`,
      status: chapter.matchType === 'missing' ? 'FAIL' : 'WARN',
      reason: reasons.join('; '),
      raw: chapter,
    });
  }

  return rows;
}

function renderExistenceTab(report, relativeWorkflowPath) {
  const missing = Number(report?.stats?.missingFiles || 0);
  const status = missing > 0 ? 'FAIL' : report?.logInput?.exists ? 'OK' : 'WARN';
  const files = (report?.files || []).map((file) => ({
    name: file.filename || 'arquivo desconhecido',
    meta: `Tradução: ${file.translationFilename || '-'} · ${report?.versionWorkflow?.workingInput || 'desconhecida'} · ${file.alignment || 'sem pareamento'}`,
  }));

  return `
    <div id="existence" class="content active">
      <div class="summary-grid">
        ${summaryCard('Status', statusIcon(status), status)}
        ${summaryCard('Arquivos de Origem', formatNumber(report?.stats?.sourceFiles || 0))}
        ${summaryCard('Arquivos Traduzidos', formatNumber(report?.stats?.translatedFiles || 0))}
        ${summaryCard('Pareamento', getPairingPercent(report))}
      </div>
      ${validationSection(status, '1.1 Verificação de correspondência de arquivos', detailsBlock([
        detailRow('EPUB original', report?.stats?.sourceFile || '-', 'OK'),
        detailRow('EPUB traduzido', report?.stats?.translatedFile || '-', 'OK'),
        detailRow('Traduções correspondentes', formatNumber(report?.stats?.matchedFiles || 0), missing > 0 ? 'FAIL' : 'OK'),
        detailRow('Arquivos faltantes', formatNumber(missing), missing > 0 ? 'FAIL' : 'OK'),
        detailRow('Log de tradução', report?.logInput?.exists ? 'encontrado' : 'ausente', report?.logInput?.exists ? 'OK' : 'WARN'),
      ]))}
      ${validationSection('OK', '1.2 Detalhes dos arquivos', fileList(files))}
      ${validationSection(report?.logInput?.exists ? 'OK' : 'WARN', '1.3 Insumo auxiliar do log', detailsBlock([
        detailRow('Arquivo', report?.logInput?.exists ? relativeWorkflowPath(report.logInput.file) : 'não encontrado', report?.logInput?.exists ? 'OK' : 'WARN'),
        detailRow('Termos informados', formatNumber(report?.logInput?.terms?.length || 0)),
        detailRow('Trocas informadas', formatNumber(report?.logInput?.replacements?.length || 0)),
      ]))}
      ${actionList('Próximas ações', missing > 0
        ? ['Adicionar o EPUB traduzido correspondente em input/translated ou input-fixed/vN.', 'Rodar a auditoria novamente.']
        : ['Continuar para validação de estrutura e padrões.'])}
    </div>`;
}

function renderStructureTab(report) {
  const structuralItems = [...(report?.issues || []), ...(report?.warnings || [])].filter(isStructuralIssue);
  const problematicSections = getProblematicSections(report);
  const sectionDiff = Math.abs(
    Number(report?.stats?.sourceSections || 0) - Number(report?.stats?.translatedSections || 0),
  );
  const status = structuralItems.some((item) => item.severity === 'FAIL')
    ? 'FAIL'
    : structuralItems.length || problematicSections.length || sectionDiff > 0
      ? 'WARN'
      : 'OK';

  return `
    <div id="structure" class="content">
      <div class="summary-grid">
        ${summaryCard('Status', statusIcon(status), status)}
        ${summaryCard('Seções Original', formatNumber(report?.stats?.sourceSections || 0))}
        ${summaryCard('Seções Tradução', formatNumber(report?.stats?.translatedSections || 0), sectionDiff > 0 ? 'WARN' : 'OK')}
        ${summaryCard('Seções Problemáticas', formatNumber(problematicSections.length), problematicSections.length ? 'WARN' : 'OK')}
      </div>
      ${validationSection(status, '2.1 Cobertura textual do EPUB', detailsBlock([
        detailRow('Parágrafos original', formatNumber(report?.stats?.sourceParagraphs || 0)),
        detailRow('Parágrafos tradução', formatNumber(report?.stats?.translatedParagraphs || 0)),
        detailRow('Caracteres original', formatNumber(report?.stats?.sourceChars || 0)),
        detailRow('Caracteres tradução', formatNumber(report?.stats?.translatedChars || 0)),
        detailRow('Diferença de seções', formatNumber(sectionDiff), sectionDiff > 0 ? 'WARN' : 'OK'),
        detailRow('Validações estruturais', formatNumber(structuralItems.length), structuralItems.length ? status : 'OK'),
      ]))}
      ${validationSection('OK', '2.2 Resumo do arquivo auditado', fileList((report?.files || []).map((file) => ({
        name: file.filename,
        meta: `${formatNumber(file.sourceParagraphs || 0)} parágrafos origem · ${formatNumber(file.translationParagraphs || 0)} parágrafos tradução · ${formatNumber(file.matchedChapters || 0)}/${formatNumber(file.chapterCount || 0)} seções pareadas`,
      }))))}
      ${problematicSections.slice(0, 15).map((row, index) => validationSection(row.status, `2.${index + 3} Seção: ${row.chapter}`, `
        ${detailsBlock([
          detailRow('Motivo', row.reason, row.status),
          detailRow('Match', row.raw?.matchType || '-'),
          detailRow('Confiança', row.raw?.confidence !== undefined ? String(row.raw.confidence) : '-'),
        ])}
      `)).join('')}
      ${structuralItems.map((item, index) => validationSection(item.severity || 'WARN', `2.${problematicSections.length + index + 3} ${item.description || item.type}`, `
        ${detailsBlock([
          detailRow('Tipo', item.type || '-'),
          detailRow('Ocorrências', formatNumber(item.occurrences || 1), item.severity || 'WARN'),
        ])}
        ${issueExamplesTable(item)}
      `)).join('')}
      ${actionList('Recomendações', structuralItems.length || problematicSections.length
        ? ['Revisar seções missing/extra e diferenças de tamanho antes de publicar nova versão.', 'Confirmar se a divisão de capítulos do EPUB traduzido preserva a obra original.']
        : ['Nenhum ajuste estrutural imediato foi detectado.'])}
    </div>`;
}

function renderPatternsTab(report, sourceReport) {
  const items = [...(report?.issues || []), ...(report?.warnings || [])]
    .filter(isPatternIssue)
    .filter((item) => {
      if (item.type !== 'epub_gender_suspicion') return true;
      const examples = item.examples || [];
      return !examples.length || examples.some((example) => !isEmbeddedGenderFalsePositive(item, example));
    });
  const sourceItems = [...(sourceReport?.issues || []), ...(sourceReport?.warnings || [])].filter(isPatternIssue);
  const occurrences = items.reduce((sum, item) => sum + Number(item.occurrences || 1), 0);
  const status = items.some((item) => item.severity === 'FAIL') ? 'FAIL' : items.length ? 'WARN' : 'OK';
  const failItems = items.filter((item) => item.severity === 'FAIL').length;
  const warnItems = items.filter((item) => item.severity === 'WARN').length;

  return `
    <div id="patterns" class="content">
      <div class="summary-grid">
        ${summaryCard('Status', statusIcon(status), status)}
        ${summaryCard('Issues Críticas', formatNumber(failItems), failItems ? 'FAIL' : 'OK')}
        ${summaryCard('Warnings', formatNumber(warnItems), warnItems ? 'WARN' : 'OK')}
        ${summaryCard('Ocorrências Totais', formatNumber(occurrences), status)}
      </div>
      ${items.length
        ? items.map((item, index) => {
          const previous = sourceItems.find((candidate) =>
            candidate.type === item.type && candidate.description === item.description);
          const delta = previous
            ? Number(item.occurrences || 1) - Number(previous.occurrences || 1)
            : null;

          return validationSection(item.severity || 'WARN', `3.${index + 1} ${item.description || item.type}`, `
            ${detailsBlock([
              detailRow('Tipo', item.type || '-'),
              detailRow('Ocorrências encontradas', formatNumber(item.occurrences || 1), item.severity || 'WARN'),
              detailRow('Comparativo com tradução inicial', delta === null ? 'sem base anterior' : `${delta >= 0 ? '+' : ''}${formatNumber(delta)}`, delta > 0 ? 'FAIL' : delta === 0 ? 'WARN' : 'OK'),
            ])}
            ${issueExamplesTable(item)}
          `);
        }).join('')
        : validationSection('OK', '3.1 Padrões de tradução', '<div class="empty-state">Nenhum padrão de tradução sinalizado nesta execução.</div>')}
      ${actionList('Recomendações', items.length
        ? ['Separar erro real de falso positivo usando os exemplos e o destaque no contexto.', 'Ajustar checks.js quando o padrão gerar ruído recorrente (ex.: frases quebradas em massa).', 'Rodar nova auditoria e conferir queda no comparativo.']
        : ['Nenhum padrão típico de tradução automática foi sinalizado.'])}
    </div>`;
}

function renderLogTab(report) {
  const logItems = [...(report?.issues || []), ...(report?.warnings || [])].filter(isLogIssue);
  const status = logItems.some((item) => item.severity === 'FAIL')
    ? 'FAIL'
    : logItems.length || !report?.logInput?.exists
      ? 'WARN'
      : 'OK';

  return `
    <div id="log" class="content">
      <div class="summary-grid">
        ${summaryCard('Status', statusIcon(status), status)}
        ${summaryCard('Termos no Log', formatNumber(report?.logInput?.terms?.length || 0))}
        ${summaryCard('Trocas no Log', formatNumber(report?.logInput?.replacements?.length || 0))}
        ${summaryCard('Achados do Log', formatNumber(logItems.length), logItems.length ? 'WARN' : 'OK')}
      </div>
      ${validationSection(status, '4.1 Validação contra Log_Traducao.txt', detailsBlock([
        detailRow('Arquivo encontrado', report?.logInput?.exists ? 'sim' : 'não', report?.logInput?.exists ? 'OK' : 'WARN'),
        detailRow('Termos informados', report?.logInput?.terms?.join(', ') || '-'),
        detailRow('Trocas informadas', (report?.logInput?.replacements || []).map((item) => `${item.from} → ${item.to}`).join('; ') || '-'),
        detailRow('Avisos do parser', (report?.logInput?.warnings || []).join('; ') || '-'),
      ]))}
      ${(report?.logInput?.replacements || []).length
        ? validationSection('OK', '4.2 Trocas declaradas no log', fileList((report.logInput.replacements || []).map((item) => ({
          name: `${item.from} → ${item.to}`,
          meta: 'Regra auxiliar declarada no início do Log_Traducao.txt',
        })), 'rule'))
        : ''}
      ${logItems.map((item, index) => validationSection(item.severity || 'WARN', `4.${index + 3} ${item.description || item.type}`, `
        ${detailsBlock([
          detailRow('Tipo', item.type || '-'),
          detailRow('Ocorrências', formatNumber(item.occurrences || 1), item.severity || 'WARN'),
        ])}
        ${issueExamplesTable(item)}
      `)).join('')}
      ${actionList('Próximas ações', !report?.logInput?.exists
        ? ['Adicionar Log_Traducao.txt em input/logs para validação auxiliar.']
        : logItems.length
          ? ['Confirmar se termos e trocas do log foram aplicados no EPUB.', 'Atualizar o log ou o EPUB conforme as regras declaradas.']
          : ['Log presente sem achados. Manter o arquivo atualizado nas próximas rodadas.'])}
    </div>`;
}

function renderVersioningTab(report) {
  const workflow = report?.versionWorkflow || {};
  const manifest = workflow.manifest || {};
  const trace = report?.workflowTrace || {};
  const currentVersion = workflow.currentVersion ? `v${workflow.currentVersion}` : 'nenhuma';
  const status = workflow.workingInput?.includes('input-fixed/v') ? 'OK' : 'WARN';
  const versions = manifest.versions || [];

  return `
    <div id="versioning" class="content">
      <div class="summary-grid">
        ${summaryCard('Status', statusIcon(status), status)}
        ${summaryCard('Versão Atual', currentVersion)}
        ${summaryCard('Origem', workflow.workingInput || 'desconhecida', null, 'font-size: 13px;')}
        ${summaryCard('Próxima Versão', workflow.nextVersion ? `v${workflow.nextVersion}` : 'v1')}
      </div>
      ${validationSection(status, '5.1 Rastreamento de versão', detailsBlock([
        detailRow('Origem da auditoria', workflow.workingInput || 'desconhecida', status),
        detailRow('Versão auditada', currentVersion),
        detailRow('Step do workflow', trace.currentStep || '-'),
        detailRow('Versões em input-fixed', (trace.versionsFound || []).join(', ') || 'nenhuma'),
      ]))}
      ${validationSection('OK', '5.2 Histórico de versões EPUB', fileList(versions.map((version) => ({
        name: `input-fixed/v${version.version}/`,
        meta: `${version.file || 'arquivo'} · origem ${version.source || '-'} · ${version.createdAt || 'sem data'}`,
      })), 'dir'))}
      ${validationSection('OK', '5.3 Fluxo de arquivos', fileList((trace.fileFlows || []).flatMap((flow) =>
        (flow.events || []).map((event) => ({
          name: event.event || 'evento',
          meta: `${event.source || event.sourcePath || '-'} → ${event.destination || '-'}`,
        })),
      ), 'flow'))}
      ${validationSection('OK', '5.4 Saídas geradas', fileList([
        { name: 'audit-dashboard-latest.html', meta: 'logs/html/' },
        { name: 'validation-report-latest.html', meta: 'logs/html/' },
        { name: 'audit-report-*.json', meta: 'logs/json/' },
        { name: 'epub-audit-summary-latest.txt', meta: 'logs/txt/' },
      ], 'out'))}
      ${actionList('Próximo ciclo', [
        workflow.workingInput?.includes('input-fixed/v')
          ? 'Continuar correções a partir da versão mais recente em input-fixed/vN.'
          : 'Gerar versão corrigida com fixEpub para auditar input-fixed/vN.',
        `Próxima versão esperada: ${workflow.nextVersion ? `v${workflow.nextVersion}` : 'v1'}.`,
      ])}
    </div>`;
}

function renderTabs() {
  return `
    <div class="tabs">
      <button class="tab-btn active" onclick="showTab(event, 'existence')">Existência e Pareamento</button>
      <button class="tab-btn" onclick="showTab(event, 'structure')">Estrutura EPUB</button>
      <button class="tab-btn" onclick="showTab(event, 'patterns')">Padrões de Tradução</button>
      <button class="tab-btn" onclick="showTab(event, 'log')">Insumos do Log</button>
      <button class="tab-btn" onclick="showTab(event, 'versioning')">Versionamento</button>
    </div>`;
}

export function writeEpubValidationTabsDashboard(report, htmlPath, {
  logsDir,
  relativeWorkflowPath = (value) => value,
} = {}) {
  const sourceReport = logsDir
    ? getLatestJsonReportByWorkingInput(logsDir, 'input/translated', report)
    : null;
  const activeReport = report || sourceReport;
  const fileLabel = getFileLabel(activeReport);

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Relatório de Validações por Tipo</title>
  <style>${validationTabStyles}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Relatório de Validações por Tipo</h1>
      <p>${escapeHtml(fileLabel)} - ${escapeHtml(activeReport?.stats?.timestamp || 'sem timestamp')}</p>
    </div>
    ${renderTabs()}
    ${renderExistenceTab(activeReport, relativeWorkflowPath)}
    ${renderStructureTab(activeReport)}
    ${renderPatternsTab(activeReport, sourceReport)}
    ${renderLogTab(activeReport)}
    ${renderVersioningTab(activeReport)}
  </div>
  <script>${validationTabScript}</script>
</body>
</html>`;

  fs.writeFileSync(htmlPath, html, 'utf8');
}
