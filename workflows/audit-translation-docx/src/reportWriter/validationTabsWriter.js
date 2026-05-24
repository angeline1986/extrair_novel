// src/reportWriter/validationTabsWriter.js
// Relatório experimental em abas por tipo de validação.

import fs from 'fs';
import {
  getLatestJsonReportByWorkingInput,
  getLatestNormalization,
} from './dashboard/dataSources.js';
import { escapeHtml, formatNumber } from './dashboard/htmlUtils.js';

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
  const label = statusIcon(status);
  return `<span class="status-badge ${kind}">${label}</span>`;
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
  if (!text || !needle) return { text: text || '-', match: needle, embedded: false };

  const lowerText = text.toLocaleLowerCase();
  const lowerNeedle = needle.toLocaleLowerCase();
  const index = lowerText.indexOf(lowerNeedle);
  if (index < 0) return { text, match: needle, embedded: false };

  const previousChar = index > 0 ? text[index - 1] : '';
  const embedded = Boolean(previousChar && /[\p{L}\p{N}]/u.test(previousChar));
  const marked = `${text.slice(0, index)}<<MATCH>>${text.slice(index, index + needle.length)}<</MATCH>>${text.slice(index + needle.length)}`;
  const tokens = marked.split(/\s+/);
  const matchTokenIndex = tokens.findIndex((token) => token.includes('<<MATCH>>'));
  const start = Math.max(0, matchTokenIndex - radius);
  const end = Math.min(tokens.length, matchTokenIndex + radius + 1);
  const clipped = `${start > 0 ? '... ' : ''}${tokens.slice(start, end).join(' ')}${end < tokens.length ? ' ...' : ''}`;

  return {
    text: clipped.replaceAll('<<MATCH>>', '').replaceAll('<</MATCH>>', ''),
    marked: clipped,
    embedded,
  };
}

function highlightMarkedContext(marked = '') {
  return escapeHtml(marked || '-')
    .replaceAll('&lt;&lt;MATCH&gt;&gt;', '<strong class="problem-highlight">')
    .replaceAll('&lt;&lt;/MATCH&gt;&gt;', '</strong>');
}

function replaceMarkedMatch(marked = '', replacement = '') {
  return marked.replace(/<<MATCH>>.*?<<\/MATCH>>/, `<<MATCH>>${replacement}<</MATCH>>`);
}

function isEmbeddedFalsePositive(issue, example) {
  return issue?.type === 'gender_issue' && wordsAroundMatch(example?.context, example?.match).embedded;
}

function suggestionForExample(issue, example) {
  const match = String(example?.match || '');
  const description = String(issue?.description || '').toLowerCase();
  const contextWindow = wordsAroundMatch(example?.context, match);
  const appearsEmbeddedInWord = contextWindow.embedded;

  if (issue?.details?.suggestion) {
    return highlightMarkedContext(replaceMarkedMatch(contextWindow.marked, issue.details.suggestion));
  }
  if (issue?.suggestion) {
    return highlightMarkedContext(replaceMarkedMatch(contextWindow.marked, issue.suggestion));
  }
  if (issue?.type === 'ENTITY_ALIAS_FOUND') return 'Confirmar se o alias deve ser trocado pelo nome canônico.';
  if (issue?.type === 'entity_candidate') return 'Confirmar se esta ocorrência representa uma entidade relevante para o glossário.';
  if (issue?.type === 'source_artifact') return highlightMarkedContext(replaceMarkedMatch(contextWindow.marked, '[remover]'));
  if (issue?.type === 'semantic_issue') {
    const replacements = new Map([
      ['Seu corpo precisa ser congelado.', 'Você deve estar congelando.'],
      ['Depois de sair do metrô, o Duque reassumiu a liderança.', 'Depois de sair do subterrâneo, o Duque reassumiu a liderança.'],
      ['Parece uma piada típica do Sul dos Estados Unidos.', 'Parece uma piada típica do Sul.'],
    ]);
    return highlightMarkedContext(replaceMarkedMatch(
      contextWindow.marked,
      replacements.get(match) || '[reescrever de forma natural]'
    ));
  }
  if (issue?.type === 'broken_sentence') return 'Revisar pontuação/quebra de frase no contexto.';
  if (issue?.type === 'name_corruption') return 'Validar se é falso positivo antes de aplicar correção automática.';
  if (issue?.type === 'gender_issue' && appearsEmbeddedInWord) {
    return 'Provável falso positivo: a ocorrência parece estar dentro de outra palavra.';
  }
  if (issue?.type === 'gender_issue' && description.includes('advérbio feminino') && /^o\s+/i.test(match)) {
    return highlightMarkedContext(replaceMarkedMatch(contextWindow.marked, match.replace(/^o\s+/i, 'a ')));
  }
  if (issue?.type === 'gender_issue' && description.includes('substantivo masculino')) {
    return 'Confirmar gênero do substantivo no contexto; este padrão pode gerar falso positivo.';
  }
  if (issue?.type === 'gender_issue') return 'Revisar concordância de gênero no trecho destacado.';

  return 'Revisar manualmente e decidir entre correção, exceção ou falso positivo.';
}

function issueExamplesTable(issue) {
  const originalExamples = (issue?.examples || []).slice(0, 8);
  const examples = originalExamples.filter((example) => !isEmbeddedFalsePositive(issue, example));

  if (originalExamples.length && !examples.length) {
    return '<div class="empty-state">Todos os exemplos coletados parecem falsos positivos por estarem embutidos dentro de outra palavra. Rode uma nova auditoria para recalcular a contagem com a regra corrigida.</div>';
  }

  if (!examples.length) return '<div class="empty-state">Sem exemplos registrados para esta validação.</div>';

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
              <td class="example-col">${suggestionForExample(issue, example)}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function entityCandidateList(candidates) {
  if (!candidates.length) return '<div class="empty-state">Nenhuma entidade candidata registrada.</div>';

  return `
    <div class="entity-candidate-list">
      ${candidates.map((candidate) => `
        <details class="entity-candidate">
          <summary>
            <span class="file-icon">person</span>
            <span>
              <strong>${escapeHtml(candidate.name)}</strong>
              <small>${formatNumber(candidate.count || 0)} ocorrência(s)</small>
            </span>
          </summary>
          <div class="details-content">
            ${(candidate.examples || []).length
              ? issueExamplesTable({
                type: 'entity_candidate',
                description: `Entidade candidata: ${candidate.name}`,
                examples: candidate.examples,
              })
              : '<div class="empty-state">Esta execução antiga só possui contagem. Rode nova auditoria para coletar amostras de contexto.</div>'}
          </div>
        </details>`).join('')}
    </div>`;
}

function getFileLabel(report) {
  return report?.files?.map((file) => file.filename).filter(Boolean).join(', ') || 'sem arquivo';
}

function getPairingPercent(report) {
  const sourceFiles = Number(report?.stats?.sourceFiles || 0);
  if (!sourceFiles) return '0%';
  return `${Math.round((Number(report?.stats?.matchedFiles || 0) / sourceFiles) * 100)}%`;
}

function isStructuralIssue(item) {
  return [
    'missing_file',
    'missing_translation',
    'missing_chapter',
    'extra_chapter',
    'short_chapter',
    'low_paragraph_count',
    'empty_translation',
  ].includes(item?.type);
}

function isEntityIssue(item) {
  return item?.type === 'ENTITY_ALIAS_FOUND';
}

function isGtPatternIssue(item) {
  return !isStructuralIssue(item) && !isEntityIssue(item);
}

function renderExistenceTab(report) {
  const missing = Number(report?.stats?.missingFiles || 0);
  const status = missing > 0 ? 'FAIL' : 'OK';
  const files = (report?.files || []).map((file) => ({
    name: file.filename || file.translationFilename || 'arquivo desconhecido',
    meta: `Origem: input/source - Tradução: ${report?.versionWorkflow?.workingInput || 'desconhecida'} - ${file.alignment || 'sem pareamento'}`,
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
        detailRow('Arquivos originais encontrados', formatNumber(report?.stats?.sourceFiles || 0), 'OK'),
        detailRow('Traduções correspondentes', formatNumber(report?.stats?.matchedFiles || 0), missing > 0 ? 'FAIL' : 'OK'),
        detailRow('Arquivos faltantes', formatNumber(missing), missing > 0 ? 'FAIL' : 'OK'),
      ]))}
      ${validationSection('OK', '1.2 Detalhes dos arquivos', fileList(files))}
      ${actionList('Próximas ações', missing > 0
        ? ['Adicionar a tradução correspondente em input/translatedGoogle ou gerar uma versão em input-fixed/vN.', 'Rodar a auditoria novamente.']
        : ['Continuar para validação de estrutura.'])}
    </div>`;
}

function renderStructureTab(report) {
  const structuralItems = [...(report?.issues || []), ...(report?.warnings || [])].filter(isStructuralIssue);
  const files = report?.files || [];
  const status = structuralItems.some((item) => item.severity === 'FAIL') ? 'FAIL' : structuralItems.length ? 'WARN' : 'OK';
  const chapters = files.reduce((sum, file) => sum + Number(file.chapterCount || 0), 0);
  const chapterIssues = files.reduce((sum, file) => sum + Number(file.chapterIssues || 0), 0);

  return `
    <div id="structure" class="content">
      <div class="summary-grid">
        ${summaryCard('Status', statusIcon(status), status)}
        ${summaryCard('Capítulos Totais', formatNumber(chapters))}
        ${summaryCard('Arquivos Pareados', formatNumber(report?.stats?.matchedFiles || 0))}
        ${summaryCard('Problemas Estruturais', formatNumber(structuralItems.length + chapterIssues), status)}
      </div>
      ${validationSection(status, '2.1 Estrutura dos documentos', detailsBlock([
        detailRow('Capítulos detectados', formatNumber(chapters)),
        detailRow('Capítulos com issues', formatNumber(chapterIssues), chapterIssues > 0 ? 'WARN' : 'OK'),
        detailRow('Validações estruturais sinalizadas', formatNumber(structuralItems.length), structuralItems.length ? status : 'OK'),
      ]))}
      ${validationSection('OK', '2.2 Resumo por arquivo', fileList(files.map((file) => ({
        name: file.filename,
        meta: `${formatNumber(file.sourceParagraphs || 0)} parágrafos origem - ${formatNumber(file.translationParagraphs || 0)} parágrafos tradução - ${formatNumber(file.chapterCount || 0)} capítulo(s)`,
      }))))}
      ${structuralItems.map((item, index) => validationSection(item.severity || 'WARN', `2.${index + 3} ${item.description || item.type}`, `
        ${detailsBlock([
          detailRow('Tipo', item.type || '-'),
          detailRow('Ocorrências', formatNumber(item.occurrences || 1), item.severity || 'WARN'),
        ])}
        ${issueExamplesTable(item)}
      `)).join('')}
      ${actionList('Recomendações', structuralItems.length
        ? ['Revisar os itens estruturais acima antes de publicar nova versão.', 'Confirmar se capítulos e parágrafos preservam a obra original.']
        : ['Nenhum ajuste estrutural imediato foi detectado.'])}
    </div>`;
}

function renderPatternsTab(report, sourceReport) {
  const items = [...(report?.issues || []), ...(report?.warnings || [])]
    .filter(isGtPatternIssue)
    .filter((item) => {
      if (item.type !== 'gender_issue') return true;
      const examples = item.examples || [];
      return !examples.length || examples.some((example) => !isEmbeddedFalsePositive(item, example));
    });
  const sourceItems = [...(sourceReport?.issues || []), ...(sourceReport?.warnings || [])].filter(isGtPatternIssue);
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
      ${items.map((item, index) => {
        const previous = sourceItems.find((candidate) => candidate.type === item.type && candidate.description === item.description);
        const delta = previous ? Number(item.occurrences || 1) - Number(previous.occurrences || 1) : null;
        return validationSection(item.severity || 'WARN', `3.${index + 1} ${item.description || item.type}`, `
          ${detailsBlock([
            detailRow('Tipo', item.type || '-'),
            detailRow('Ocorrências encontradas', formatNumber(item.occurrences || 1), item.severity || 'WARN'),
            detailRow('Comparativo com fonte bruta', delta === null ? 'sem base anterior' : `${delta >= 0 ? '+' : ''}${formatNumber(delta)}`, delta > 0 ? 'FAIL' : delta === 0 ? 'WARN' : 'OK'),
          ])}
          ${issueExamplesTable(item)}
        `);
      }).join('')}
      ${actionList('Recomendações', items.length
        ? ['Separar erro real de falso positivo usando os exemplos.', 'Criar ou ajustar regras somente para padrões confirmados.', 'Rodar nova auditoria e conferir queda no comparativo.']
        : ['Nenhum padrão típico de tradução automática foi sinalizado.'])}
    </div>`;
}

function renderEntitiesTab(report, normalization) {
  const consistency = report?.entityConsistency || {};
  const files = consistency.files || [];
  const candidates = files.flatMap((file) => file.sourceEntityCandidates || []);
  const status = consistency.totalAliasOccurrences > 0 ? 'WARN' : 'OK';
  const replacements = normalization?.entityNormalization?.replacements || [];

  return `
    <div id="entities" class="content">
      <div class="summary-grid">
        ${summaryCard('Status', statusIcon(status), status)}
        ${summaryCard('Entidades Identificadas', formatNumber(candidates.length))}
        ${summaryCard('Aliases Encontrados', formatNumber(consistency.totalAliasOccurrences || 0), status)}
        ${summaryCard('Correções Aplicadas', formatNumber(replacements.reduce((sum, item) => sum + Number(item.occurrences || 0), 0)))}
      </div>
      ${validationSection(status, '4.1 Verificação contra glossário', detailsBlock([
        detailRow('Arquivos analisados', formatNumber(files.length)),
        detailRow('Tipos de alias pendentes', formatNumber(consistency.aliasesFound || 0), status),
        detailRow('Ocorrências pendentes', formatNumber(consistency.totalAliasOccurrences || 0), status),
      ]))}
      ${validationSection('OK', '4.2 Entidades candidatas detectadas', entityCandidateList(candidates.slice(0, 20)))}
      ${validationSection(status, '4.3 Aliases pendentes', fileList((consistency.issues || []).map((issue) => ({
        name: `${issue.found} -> ${issue.canonical}`,
        meta: `${formatNumber(issue.occurrences || 0)} ocorrência(s) - ${issue.suggestion || 'revisar contexto'}`,
      })), 'alias'))}
      ${actionList('Próximas ações', consistency.totalAliasOccurrences > 0
        ? ['Confirmar se cada alias pendente é o mesmo personagem.', 'Atualizar entityGlossary quando a substituição for segura.', 'Reauditar depois da normalização.']
        : ['Manter glossário como está.', 'Continuar monitorando novas entidades em futuras versões.'])}
    </div>`;
}

function renderOllamaTab(report) {
  const reviews = report?.ollamaResults || [];
  const failing = reviews.filter((item) => item.review?.status === 'fail');
  const warning = reviews.filter((item) => item.review?.status === 'warning');
  const avgConfidence = reviews.length
    ? reviews.reduce((sum, item) => sum + Number(item.confidence || 0), 0) / reviews.length
    : 0;
  const status = failing.length ? 'FAIL' : warning.length ? 'WARN' : 'OK';

  return `
    <div id="ollama" class="content">
      <div class="summary-grid">
        ${summaryCard('Status', statusIcon(status), status)}
        ${summaryCard('Capítulos Revisados', formatNumber(reviews.length))}
        ${summaryCard('Confiança Média', reviews.length ? avgConfidence.toFixed(2) : 'n/a', avgConfidence && avgConfidence < 0.65 ? 'WARN' : 'OK')}
        ${summaryCard('Issues Encontradas', formatNumber(failing.length + warning.length), status)}
      </div>
      ${reviews.map((item, index) => validationSection(item.review?.status || 'OK', `5.${index + 1} Revisão de baixa confiança`, detailsBlock([
        detailRow('Tipo', item.type || '-'),
        detailRow('Confiança de alinhamento', Number(item.confidence || 0).toFixed(2), item.confidence < 0.65 ? 'WARN' : 'OK'),
        detailRow('Resultado Ollama', item.review?.status || 'sem revisão', item.review?.status || 'OK'),
        detailRow('Confiança do modelo', item.review?.confidence ?? 'n/a'),
        detailRow('Problema', item.review?.problem || 'Nenhum'),
        detailRow('Sugestão', item.review?.suggestion || 'Nenhuma'),
      ]))).join('')}
      ${actionList('Conclusão', reviews.length
        ? ['Usar a revisão Ollama como apoio para capítulos com baixa confiança.', 'Se houver fail/warning, revisar manualmente antes de aceitar o DOCX final.']
        : ['Nenhum capítulo exigiu revisão Ollama nesta auditoria.'])}
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
      ${validationSection(status, '6.1 Rastreamento de versão', detailsBlock([
        detailRow('Origem da auditoria', workflow.workingInput || 'desconhecida', status),
        detailRow('Motivo da origem', workflow.workingInputReason || '-'),
        detailRow('Versão auditada', currentVersion),
        detailRow('Step do workflow', trace.currentStep || '-'),
      ]))}
      ${validationSection('OK', '6.2 Histórico de versões', fileList(versions.map((version) => ({
        name: `input-fixed/v${version.version}/`,
        meta: `${version.file || 'arquivo'} - origem ${version.source || '-'} - criado em ${version.createdAt || '-'}`,
      })), 'dir'))}
      ${validationSection('OK', '6.3 Fluxo de arquivos', fileList((trace.fileFlows || []).flatMap((flow) =>
        (flow.events || []).map((event) => ({
          name: event.stage || event.event,
          meta: `${event.source || '-'} -> ${event.destination || '-'}`,
        }))
      ), 'flow'))}
      ${actionList('Próximo ciclo', [
        workflow.workingInput?.includes('input-fixed/v')
          ? 'A próxima auditoria deve continuar partindo da versão mais recente em input-fixed/vN.'
          : 'Gerar a primeira versão corrigida para passar a auditar input-fixed/vN.',
        `A próxima versão esperada é ${workflow.nextVersion ? `v${workflow.nextVersion}` : 'v1'}.`,
      ])}
    </div>`;
}

function renderTabs() {
  return `
    <div class="tabs">
      <button class="tab-btn active" onclick="showTab(event, 'existence')">Existência e Pareamento</button>
      <button class="tab-btn" onclick="showTab(event, 'structure')">Estrutura de Capítulos</button>
      <button class="tab-btn" onclick="showTab(event, 'patterns')">Padrões do GT</button>
      <button class="tab-btn" onclick="showTab(event, 'entities')">Entidades</button>
      <button class="tab-btn" onclick="showTab(event, 'ollama')">Revisão Ollama</button>
      <button class="tab-btn" onclick="showTab(event, 'versioning')">Versionamento</button>
    </div>`;
}

export const validationTabStyles = `*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:linear-gradient(135deg,#216AC4 0%,#61acf7 100%);padding:20px;min-height:100vh;color:#1f2937}
.container{max-width:1200px;margin:0 auto;background:white;border-radius:10px;box-shadow:0 10px 40px rgba(0,0,0,.18);overflow:hidden}
.header{background:linear-gradient(135deg,#216AC4 0%,#0A66C2 100%);color:white;padding:30px}
.header h1{font-size:28px;margin-bottom:8px}.header p{opacity:.92;font-size:14px}
.tabs{display:flex;border-bottom:2px solid #d8e2ef;background:#eef4fb;overflow-x:auto}
.tab-btn{flex:1;padding:16px 20px;background:none;border:none;cursor:pointer;font-size:14px;font-weight:600;color:#52657c;border-bottom:3px solid transparent;transition:all .2s;white-space:nowrap;min-width:150px}
.tab-btn:hover{background:#e0f2ff;color:#216AC4}.tab-btn.active{color:#216AC4;border-bottom-color:#216AC4;background:white}
.content{display:none;padding:30px;animation:fadeIn .2s}.content.active{display:block}@keyframes fadeIn{from{opacity:0}to{opacity:1}}
.validation-section{margin-bottom:30px}.validation-title{display:flex;align-items:center;gap:12px;font-size:16px;font-weight:700;margin-bottom:16px;color:#1f2937}
.status-badge{display:inline-flex;align-items:center;justify-content:center;min-width:28px;height:28px;border-radius:50%;font-size:11px;font-weight:800;color:white;text-transform:uppercase}.status-badge.ok{background:#4CAF50}.status-badge.warn{background:#FF9800}.status-badge.fail{background:#F44336}
.validation-details{background:#f7fbff;border-left:4px solid #216AC4;padding:16px;border-radius:4px;margin-bottom:16px}.detail-row{display:flex;justify-content:space-between;gap:18px;padding:8px 0;border-bottom:1px solid #d8e2ef}.detail-row:last-child{border-bottom:none}.detail-label{font-weight:600;color:#52657c}.detail-value{color:#1f2937;text-align:right}
.file-list{background:white;border:1px solid #d8e2ef;border-radius:4px;list-style:none}.file-item{padding:12px 16px;border-bottom:1px solid #d8e2ef;display:flex;gap:12px;align-items:center}.file-item:last-child{border-bottom:none}.file-icon{font-size:12px;text-transform:uppercase;color:#216AC4;font-weight:800}.file-info{flex:1}.file-name{font-weight:700;color:#1f2937}.file-meta{font-size:12px;color:#52657c;margin-top:4px;overflow-wrap:anywhere}
.summary-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px}.summary-card{background:white;border:1px solid #d8e2ef;border-radius:6px;padding:16px;text-align:center}.summary-card-label{font-size:12px;color:#52657c;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px}.summary-card-value{font-size:32px;font-weight:800;color:#216AC4;overflow-wrap:anywhere}
.action-list{background:#eef8ff;border-left:4px solid #0078d4;padding:16px;border-radius:4px;margin-top:16px}.action-list-title{font-weight:700;color:#1e5a96;margin-bottom:8px;font-size:14px}.action-list-items{list-style:none}.action-item{padding:6px 0;color:#1f2937;font-size:13px}.action-item:before{content:'-> ';color:#0078d4;font-weight:800;margin-right:8px}
details.expandable{border:1px solid #d8e2ef;border-radius:8px;margin-bottom:18px;overflow:hidden;background:#fafafa}details.expandable[open]>summary{background:#eef4ff}details.expandable summary{list-style:none;cursor:pointer;padding:16px 18px;display:flex;align-items:center;gap:12px;font-size:16px;font-weight:700;color:#1f2937;border-bottom:1px solid #d8e2ef}details.expandable summary::-webkit-details-marker{display:none}details.expandable summary::after{content:'v';margin-left:auto;font-size:14px;transition:transform .2s}details.expandable[open] summary::after{transform:rotate(180deg)}
.details-content{padding:18px}.example-title{font-weight:700;color:#216AC4;margin-bottom:8px;font-size:12px}.example-table{width:100%;border-collapse:collapse;margin-top:12px;font-size:13px}.example-table th,.example-table td{border:1px solid #d8e2ef;padding:10px 12px;text-align:left}.example-table th:first-child,.example-table td:first-child{text-align:center;width:62px}.example-table th{background:#eef4fb;color:#1f2937;font-weight:700}.example-table td.example-col{vertical-align:top}.problem-highlight{background:#d9eeff;color:#0A66C2;border-radius:3px;padding:0 3px}.master-checkbox,.example-checkbox input[type=checkbox]{accent-color:#216AC4;cursor:pointer}.empty-state{padding:14px;border:1px dashed #d8e2ef;border-radius:6px;color:#52657c;background:#f7fbff}.entity-candidate-list{display:grid;gap:10px}.entity-candidate{border:1px solid #d8e2ef;border-radius:8px;background:white;overflow:hidden}.entity-candidate summary{cursor:pointer;display:flex;gap:12px;align-items:center;padding:13px 14px}.entity-candidate summary small{display:block;color:#52657c;margin-top:3px}.entity-candidate[open] summary{background:#eef8ff;border-bottom:1px solid #d8e2ef}
@media(max-width:760px){body{padding:10px}.content{padding:18px}.header{padding:22px}.detail-row{display:grid}.detail-value{text-align:left}.tab-btn{min-width:210px}}`;

export const validationTabScript = `function showTab(event,tabName){document.querySelectorAll('.content').forEach(content=>content.classList.remove('active'));document.querySelectorAll('.tab-btn').forEach(btn=>btn.classList.remove('active'));document.getElementById(tabName).classList.add('active');event.target.classList.add('active')}
function wrapValidationSections(){document.querySelectorAll('.validation-section').forEach(section=>{if(section.querySelector('details.expandable'))return;const title=section.querySelector('.validation-title');if(!title)return;const details=document.createElement('details');details.className='expandable';details.open=true;const summary=document.createElement('summary');summary.className='validation-title';summary.innerHTML=title.innerHTML;const contentWrapper=document.createElement('div');contentWrapper.className='details-content';while(section.children.length>1)contentWrapper.appendChild(section.children[1]);details.appendChild(summary);details.appendChild(contentWrapper);section.insertBefore(details,title);title.remove()})}
function updateMasterCheckboxState(container){const master=container.querySelector('.master-checkbox');if(!master)return;const checkboxes=Array.from(container.querySelectorAll('.example-checkbox input[type=checkbox]'));const allChecked=checkboxes.length>0&&checkboxes.every(checkbox=>checkbox.checked);const noneChecked=checkboxes.length>0&&checkboxes.every(checkbox=>!checkbox.checked);master.checked=allChecked;master.indeterminate=!allChecked&&!noneChecked}
function bindExampleCheckboxControls(){document.querySelectorAll('.details-content').forEach(content=>{const master=content.querySelector('.master-checkbox');const checkboxes=content.querySelectorAll('.example-checkbox input[type=checkbox]');if(master)master.addEventListener('change',()=>{checkboxes.forEach(checkbox=>{checkbox.checked=master.checked});updateMasterCheckboxState(content)});checkboxes.forEach(checkbox=>checkbox.addEventListener('change',()=>updateMasterCheckboxState(content)));updateMasterCheckboxState(content)})}
window.addEventListener('DOMContentLoaded',()=>{wrapValidationSections();bindExampleCheckboxControls()});`;

export function writeValidationTabsDashboard(report, htmlPath, { logsDir } = {}) {
  const sourceReport = logsDir ? getLatestJsonReportByWorkingInput(logsDir, 'input/translatedGoogle', report) : null;
  const normalization = logsDir ? getLatestNormalization(logsDir) : null;
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
    ${renderExistenceTab(activeReport)}
    ${renderStructureTab(activeReport)}
    ${renderPatternsTab(activeReport, sourceReport)}
    ${renderEntitiesTab(activeReport, normalization)}
    ${renderOllamaTab(activeReport)}
    ${renderVersioningTab(activeReport)}
  </div>
  <script>${validationTabScript}</script>
</body>
</html>`;

  fs.writeFileSync(htmlPath, html, 'utf8');
}
