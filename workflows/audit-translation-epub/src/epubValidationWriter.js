// Relatório de validação por abas (padrão audit-translation-docx).

import fs from 'fs';
import path from 'path';
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

function readJsonIfExists(logsDir, filename) {
  if (!logsDir) return null;
  const filePath = path.join(logsDir, filename);
  if (!fs.existsSync(filePath)) return null;

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function loadCorrectionArtifacts(logsDir) {
  return {
    correctionReport: readJsonIfExists(logsDir, 'correction-report.json'),
    postValidation: readJsonIfExists(logsDir, 'post-correction-validation.json'),
    reauditoriaSummary: readJsonIfExists(logsDir, 'reauditoria-summary.json'),
    reviewQueue: readJsonIfExists(logsDir, 'review-queue.json'),
    assistedReview: readJsonIfExists(logsDir, 'assisted-review-suggestions.json'),
    assistedReviewModelTrace: readJsonIfExists(logsDir, 'assisted-review-model-trace.json'),
    semanticCandidates: readJsonIfExists(logsDir, 'semantic-candidates.json'),
  };
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

function correctionRows(corrections = []) {
  if (!corrections.length) return '<div class="empty-state">Nenhuma correção aplicada registrada.</div>';

  return `
    <table class="example-table">
      <thead>
        <tr>
          <th>Tipo</th>
          <th>Origem</th>
          <th>Before</th>
          <th>After</th>
          <th>Arquivo</th>
          <th>Node</th>
          <th>Confiança</th>
        </tr>
      </thead>
      <tbody>
        ${corrections.slice(0, 80).map((item) => `
          <tr>
            <td class="example-col">${escapeHtml(item.type || '-')}</td>
            <td class="example-col">${escapeHtml(item.source || '-')}</td>
            <td class="example-col">${escapeHtml(item.before || '-')}</td>
            <td class="example-col">${escapeHtml(item.after || '-')}</td>
            <td class="example-col">${escapeHtml(item.filePath || '-')}</td>
            <td class="example-col">${escapeHtml(item.nodeId || '-')}</td>
            <td class="example-col">${escapeHtml(String(item.confidence ?? '-'))}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

function skippedRows(actions = []) {
  if (!actions.length) return '<div class="empty-state">Nenhuma ação ignorada registrada.</div>';

  return `
    <table class="example-table">
      <thead>
        <tr>
          <th>Action</th>
          <th>Tipo</th>
          <th>Modo</th>
          <th>Origem</th>
          <th>Status</th>
          <th>Motivo</th>
        </tr>
      </thead>
      <tbody>
        ${actions.slice(0, 80).map((item) => `
          <tr>
            <td class="example-col">${escapeHtml(item.actionId || '-')}</td>
            <td class="example-col">${escapeHtml(item.type || '-')}</td>
            <td class="example-col">${escapeHtml(item.mode || '-')}</td>
            <td class="example-col">${escapeHtml(item.source || '-')}</td>
            <td class="example-col">${escapeHtml(item.status || '-')}</td>
            <td class="example-col">${escapeHtml(item.reason || '-')}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

function reviewQueueRows(reviewQueue) {
  const items = reviewQueue?.items || [];
  if (!items.length) return '<div class="empty-state">Nenhum item pendente de revisão.</div>';

  return `
    <table class="example-table">
      <thead>
        <tr>
          <th>Status</th>
          <th>Tipo</th>
          <th>Arquivo</th>
          <th>Node</th>
          <th>Confidence</th>
          <th>Motivo</th>
          <th>Contexto</th>
          <th>Preview</th>
        </tr>
      </thead>
      <tbody>
        ${items.slice(0, 80).map((item) => `
          <tr>
            <td class="example-col">${escapeHtml(item.status || 'pending')}</td>
            <td class="example-col">${escapeHtml(item.type || '-')}</td>
            <td class="example-col">${escapeHtml(item.filePath || '-')}</td>
            <td class="example-col">${escapeHtml(item.nodeId || '-')}</td>
            <td class="example-col">${escapeHtml(String(item.confidence ?? '-'))}</td>
            <td class="example-col">${escapeHtml(item.notAppliedReason || item.reason || '-')}</td>
            <td class="example-col">${escapeHtml([
              item.previousParagraph ? `Anterior: ${item.previousParagraph}` : null,
              item.currentParagraph ? `Atual: ${item.currentParagraph}` : null,
              item.nextParagraph ? `Posterior: ${item.nextParagraph}` : null,
              `Alinhamento: ${item.alignmentReason || '-'} (${item.alignmentConfidence ?? '-'})`,
              `Parágrafo: ${item.paragraphAlignmentReason || '-'} (${item.paragraphAlignmentConfidence ?? '-'})`,
              item.originalAlignedText ? `Original: ${item.originalAlignedText}` : null,
            ].filter(Boolean).join(' | ') || '-')}</td>
            <td class="example-col">${escapeHtml(item.textPreview || '-')}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

function assistedReviewRows(assistedReview) {
  const suggestions = assistedReview?.suggestions || [];
  if (!suggestions.length) return '<div class="empty-state">Nenhuma sugestão assistida gerada.</div>';

  return `
    <table class="example-table">
      <thead>
        <tr>
          <th>Review item</th>
          <th>Status</th>
          <th>Origem</th>
          <th>Tipo</th>
          <th>Arquivo</th>
          <th>Node</th>
          <th>Confidence</th>
          <th>Before</th>
          <th>Suggested after</th>
          <th>Riscos</th>
          <th>Contexto</th>
          <th>Reason</th>
        </tr>
      </thead>
      <tbody>
        ${suggestions.slice(0, 80).map((item) => `
          <tr>
            <td class="example-col">${escapeHtml(item.reviewQueueItemId || '-')}</td>
            <td class="example-col">${escapeHtml(item.suggestionStatus || '-')}</td>
            <td class="example-col">${escapeHtml(item.source || '-')}</td>
            <td class="example-col">${escapeHtml(item.type || '-')}</td>
            <td class="example-col">${escapeHtml(item.filePath || '-')}</td>
            <td class="example-col">${escapeHtml(item.nodeId || '-')}</td>
            <td class="example-col">${escapeHtml(String(item.confidence ?? '-'))}</td>
            <td class="example-col">${escapeHtml(item.before || '-')}</td>
            <td class="example-col">${escapeHtml(item.suggestedAfter || '-')}</td>
            <td class="example-col">${escapeHtml(Array.isArray(item.risks) && item.risks.length ? item.risks.join(' | ') : '-')}</td>
            <td class="example-col">${escapeHtml([
              item.previousParagraph ? `Anterior: ${item.previousParagraph}` : null,
              item.currentParagraph ? `Atual: ${item.currentParagraph}` : null,
              item.nextParagraph ? `Posterior: ${item.nextParagraph}` : null,
              `Alinhamento: ${item.alignmentReason || '-'} (${item.alignmentConfidence ?? '-'})`,
              `Parágrafo: ${item.paragraphAlignmentReason || '-'} (${item.paragraphAlignmentConfidence ?? '-'})`,
              item.originalAlignedText ? `Original: ${item.originalAlignedText}` : null,
            ].filter(Boolean).join(' | ') || '-')}</td>
            <td class="example-col">${escapeHtml(item.reason || '-')}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

function renderCorrectionsTab(artifacts) {
  const correctionReport = artifacts.correctionReport || {};
  const postValidation = artifacts.postValidation || {};
  const reauditoriaSummary = artifacts.reauditoriaSummary || {};
  const applied = correctionReport.appliedCorrections || [];
  const skipped = correctionReport.skippedActions || [];
  const correctionValidation = postValidation.correctionValidation || {};
  const textComparison = postValidation.textComparison || {};
  const packageValidation = postValidation.packageValidation || {};
  const reviewQueue = artifacts.reviewQueue || {};
  const reviewSummary = reviewQueue.summary || {};
  const assistedReview = artifacts.assistedReview || {};
  const assistedSummary = assistedReview.summary || {};
  const assistedTrace = artifacts.assistedReviewModelTrace || {};
  const traceSummary = assistedTrace.summary || {};
  const traceAdapter = assistedTrace.adapter || {};
  const result = reauditoriaSummary.result || 'unknown';
  const resultStatus = result === 'regression' ? 'FAIL' : result === 'unknown' ? 'WARN' : 'OK';

  return `
    <div id="corrections" class="content">
      <div class="summary-grid">
        ${summaryCard('Status final', result, resultStatus)}
        ${summaryCard('Correções aplicadas', formatNumber(applied.length), applied.length ? 'OK' : 'WARN')}
        ${summaryCard('Ações ignoradas', formatNumber(skipped.length), skipped.length ? 'WARN' : 'OK')}
        ${summaryCard('Validação EPUB', postValidation.status || 'unknown', postValidation.status || 'WARN')}
      </div>
      ${validationSection(applied.length ? 'OK' : 'WARN', '6.1 Correções aplicadas no XHTML', correctionRows(applied))}
      ${validationSection(skipped.length ? 'WARN' : 'OK', '6.2 Ações pendentes ou ignoradas', skippedRows(skipped))}
      ${validationSection((reviewSummary.totalItems || 0) ? 'WARN' : 'OK', '6.3 Review queue', `
        ${detailsBlock([
          detailRow('Itens totais', formatNumber(reviewSummary.totalItems || 0), (reviewSummary.totalItems || 0) ? 'WARN' : 'OK'),
          detailRow('Pending', formatNumber(reviewSummary.pending || 0), (reviewSummary.pending || 0) ? 'WARN' : 'OK'),
          detailRow('Com contexto expandido', formatNumber(reviewSummary.contextEnriched || 0)),
          detailRow('Alinhamento original confiável', formatNumber(reviewSummary.reliableOriginalAlignment || 0)),
          detailRow('Sem originalAlignedText por segurança', formatNumber(reviewSummary.originalAlignmentSkipped || 0), (reviewSummary.originalAlignmentSkipped || 0) ? 'WARN' : 'OK'),
          detailRow('Alinhamento de parágrafo confiável', formatNumber(reviewSummary.reliableParagraphAlignment || 0)),
          detailRow('Sem parágrafo alinhado por segurança', formatNumber(reviewSummary.paragraphAlignmentSkipped || 0), (reviewSummary.paragraphAlignmentSkipped || 0) ? 'WARN' : 'OK'),
          detailRow('Approved', formatNumber(reviewSummary.approved || 0)),
          detailRow('Rejected', formatNumber(reviewSummary.rejected || 0)),
          detailRow('Needs context', formatNumber(reviewSummary.needsContext || 0), (reviewSummary.needsContext || 0) ? 'WARN' : 'OK'),
        ])}
        ${reviewQueueRows(reviewQueue)}
      `)}
      ${validationSection((assistedSummary.totalSuggestions || 0) ? 'WARN' : 'OK', '6.4 Sugestões assistidas', `
        ${detailsBlock([
          detailRow('Sugestões geradas', formatNumber(assistedSummary.totalSuggestions || 0), (assistedSummary.totalSuggestions || 0) ? 'WARN' : 'OK'),
          detailRow('Requer aprovação humana', formatNumber(assistedSummary.requiresHumanApproval || 0), (assistedSummary.requiresHumanApproval || 0) ? 'WARN' : 'OK'),
          detailRow('Com contexto expandido', formatNumber(assistedSummary.contextEnriched || 0)),
          detailRow('Alinhamento original confiável', formatNumber(assistedSummary.reliableOriginalAlignment || 0)),
          detailRow('Sem originalAlignedText por segurança', formatNumber(assistedSummary.originalAlignmentSkipped || 0), (assistedSummary.originalAlignmentSkipped || 0) ? 'WARN' : 'OK'),
          detailRow('Alinhamento de parágrafo confiável', formatNumber(assistedSummary.reliableParagraphAlignment || 0)),
          detailRow('Sem parágrafo alinhado por segurança', formatNumber(assistedSummary.paragraphAlignmentSkipped || 0), (assistedSummary.paragraphAlignmentSkipped || 0) ? 'WARN' : 'OK'),
          detailRow('Com suggestedAfter', formatNumber(assistedSummary.withSuggestedAfter || 0)),
          detailRow('Suggestion available', formatNumber(assistedSummary.suggestionAvailable || 0)),
          detailRow('Needs human translation', formatNumber(assistedSummary.needsHumanTranslation || 0)),
          detailRow('Insufficient context', formatNumber(assistedSummary.insufficientContext || 0), (assistedSummary.insufficientContext || 0) ? 'WARN' : 'OK'),
          detailRow('Modelo opcional', traceAdapter.enabled ? `${traceAdapter.provider || 'modelo'}:${traceAdapter.model || '-'}` : 'desativado'),
          detailRow('Sugestões aceitas do Ollama', formatNumber(assistedSummary.ollamaSuggestions || 0)),
          detailRow('Fallback determinístico', formatNumber(assistedSummary.deterministicFallback || 0), (assistedSummary.deterministicFallback || 0) ? 'WARN' : 'OK'),
          detailRow('Modelo rejeitadas/falhas', `${formatNumber(traceSummary.rejected || 0)} / ${formatNumber(traceSummary.failed || 0)}`, ((traceSummary.rejected || 0) + (traceSummary.failed || 0)) ? 'WARN' : 'OK'),
        ])}
        ${assistedReviewRows(assistedReview)}
      `)}
      ${validationSection(postValidation.status || 'WARN', '6.5 Validação pós-correção', detailsBlock([
        detailRow('ZIP legível', packageValidation.zipReadable ? 'sim' : 'não', packageValidation.zipReadable ? 'OK' : 'FAIL'),
        detailRow('mimetype/container/OPF', packageValidation.mimetypePresent && packageValidation.containerPresent && packageValidation.opfPresent ? 'OK' : 'incompleto', packageValidation.mimetypePresent && packageValidation.containerPresent && packageValidation.opfPresent ? 'OK' : 'FAIL'),
        detailRow('Manifest/spine', packageValidation.manifestValid && packageValidation.spineValid ? 'OK' : 'incompleto', packageValidation.manifestValid && packageValidation.spineValid ? 'OK' : 'FAIL'),
        detailRow('Mudança textual real', textComparison.textChanged ? 'sim' : 'não', textComparison.textChanged ? 'OK' : 'WARN'),
        detailRow('Correções confirmadas', `${formatNumber(correctionValidation.confirmedCorrections || 0)} / ${formatNumber(correctionValidation.appliedCorrections || 0)}`, correctionValidation.unconfirmedCorrections ? 'WARN' : 'OK'),
      ]))}
      ${validationSection(resultStatus, '6.6 Reauditoria automática', detailsBlock([
        detailRow('Resultado', result, resultStatus),
        detailRow('Issues antes/depois', `${formatNumber(reauditoriaSummary.issuesBefore || 0)} -> ${formatNumber(reauditoriaSummary.issuesAfter || 0)}`),
        detailRow('Warnings antes/depois', `${formatNumber(reauditoriaSummary.warningsBefore || 0)} -> ${formatNumber(reauditoriaSummary.warningsAfter || 0)}`),
        detailRow('Candidates antes/depois', `${formatNumber(reauditoriaSummary.correctionCandidatesBefore || 0)} -> ${formatNumber(reauditoriaSummary.correctionCandidatesAfter || 0)}`),
        detailRow('Correções aplicadas', formatNumber(reauditoriaSummary.appliedCorrections || 0)),
      ]))}
      ${actionList('Próximas ações', skipped.length
        ? ['Revisar ações auto_review/manual_only antes de liberar correções contextuais.', 'Manter aplicação automática restrita a auto_safe até a próxima milestone.']
        : ['Nenhuma ação pendente registrada no correction-report atual.'])}
    </div>`;
}

function semanticCandidateRows(semanticAudit) {
  const candidates = semanticAudit?.semanticCandidates || [];
  if (!candidates.length) return '<div class="empty-state">Nenhum candidato semântico registrado.</div>';

  return `
    <table class="example-table">
      <thead>
        <tr>
          <th>Severidade</th>
          <th>Tipo</th>
          <th>Confiança</th>
          <th>Score</th>
          <th>Arquivo</th>
          <th>Node</th>
          <th>Motivo</th>
          <th>Contexto</th>
        </tr>
      </thead>
      <tbody>
        ${candidates.slice(0, 80).map((item) => `
          <tr>
            <td class="example-col">${escapeHtml(item.severity || '-')}</td>
            <td class="example-col">${escapeHtml(item.type || '-')}</td>
            <td class="example-col">${escapeHtml(item.confidence || '-')}</td>
            <td class="example-col">${escapeHtml(String(item.confidenceScore ?? '-'))}</td>
            <td class="example-col">${escapeHtml(item.location?.filePath || '-')}</td>
            <td class="example-col">${escapeHtml(item.location?.nodeId || '-')}</td>
            <td class="example-col">${escapeHtml(item.reason || '-')}</td>
            <td class="example-col">${escapeHtml([
              item.context?.currentParagraph ? `Atual: ${item.context.currentParagraph}` : null,
              item.context?.originalAlignedText ? `Original: ${item.context.originalAlignedText}` : null,
              item.evidence ? `Evidência: ${JSON.stringify(item.evidence)}` : null,
            ].filter(Boolean).join(' | ') || '-')}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

function renderSemanticTab(artifacts) {
  const semanticAudit = artifacts.semanticCandidates || {};
  const summary = semanticAudit.summary || {};
  const severity = summary.severity || {};
  const confidence = summary.confidence || {};

  return `
    <div id="semantic" class="content">
      <div class="summary-grid">
        ${summaryCard('Semantic candidates', formatNumber(summary.total || 0), (summary.total || 0) ? 'WARN' : 'OK')}
        ${summaryCard('High / medium / low', `${formatNumber(severity.high || 0)} / ${formatNumber(severity.medium || 0)} / ${formatNumber(severity.low || 0)}`, (severity.high || severity.medium) ? 'WARN' : 'OK')}
        ${summaryCard('Deterministic', formatNumber(confidence.deterministic || 0))}
        ${summaryCard('Heuristic / model', `${formatNumber(confidence.heuristic || 0)} / ${formatNumber(confidence.modelAssisted || 0)}`)}
      </div>
      ${validationSection((summary.total || 0) ? 'WARN' : 'OK', '7.1 Candidatos semânticos para revisão humana', `
        ${detailsBlock([
          detailRow('Não alimenta correctionPlan', semanticAudit.policy?.feedsCorrectionPlan === false ? 'sim' : 'verificar', semanticAudit.policy?.feedsCorrectionPlan === false ? 'OK' : 'WARN'),
          detailRow('Não aplica correções', semanticAudit.policy?.appliesCorrections === false ? 'sim' : 'verificar', semanticAudit.policy?.appliesCorrections === false ? 'OK' : 'WARN'),
          detailRow('Requer aprovação humana', semanticAudit.policy?.requiresHumanApproval ? 'sim' : 'verificar', semanticAudit.policy?.requiresHumanApproval ? 'OK' : 'WARN'),
        ])}
        ${semanticCandidateRows(semanticAudit)}
      `)}
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
      <button class="tab-btn" onclick="showTab(event, 'corrections')">Correções</button>
      <button class="tab-btn" onclick="showTab(event, 'semantic')">Semântica</button>
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
  const correctionArtifacts = loadCorrectionArtifacts(logsDir);

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
    ${renderCorrectionsTab(correctionArtifacts)}
    ${renderSemanticTab(correctionArtifacts)}
  </div>
  <script>${validationTabScript}</script>
</body>
</html>`;

  fs.writeFileSync(htmlPath, html, 'utf8');
}
