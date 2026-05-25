// Gera o dashboard HTML do workflow EPUB no mesmo padrão do DOCX.

import fs from 'fs';
import path from 'path';
import { dashboardScript, dashboardStyles } from '../../audit-translation-docx/src/reportWriter/dashboard/assets.js';
import {
  getLatestJsonReport,
  getLatestJsonReportByWorkingInput,
} from '../../audit-translation-docx/src/reportWriter/dashboard/dataSources.js';
import {
  renderDocumentPreviews,
  renderFileInventory,
  renderProblematicChapters,
  renderTechnicalTrace,
} from '../../audit-translation-docx/src/reportWriter/dashboard/technicalSections.js';
import {
  escapeHtml,
  formatDelta,
  formatNumber,
  getDeltaValue,
  getTrendLabel,
  renderDetailPanel,
  statusBadge,
  statusClass,
} from '../../audit-translation-docx/src/reportWriter/dashboard/htmlUtils.js';

function sumIssueOccurrences(report, predicate) {
  return (report?.issues || [])
    .filter(predicate)
    .reduce((sum, issue) => sum + Number(issue.occurrences || 1), 0);
}

function getIssueOccurrence(report, description) {
  return sumIssueOccurrences(
    report,
    (issue) => issue.description === description || issue.type === description,
  );
}

export function loadEpubManifest(workflowRoot) {
  const manifestPath = path.join(workflowRoot, 'input-fixed/manifest.json');

  if (!fs.existsSync(manifestPath)) {
    return {
      currentVersion: 0,
      currentPath: 'output',
      origin: 'input/translated',
      versions: [],
      finalOutput: 'output',
    };
  }

  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch {
    return {
      currentVersion: 0,
      currentPath: 'output',
      origin: 'input/translated',
      versions: [],
      finalOutput: 'output',
    };
  }
}

export function detectWorkingInput(translationPath, manifest) {
  const normalized = String(translationPath || '').replaceAll('\\', '/');

  const fixedMatch = normalized.match(/input-fixed\/v(\d+)/i);
  if (fixedMatch) return `input-fixed/v${fixedMatch[1]}`;

  if (normalized.includes('input/translated')) {
    return manifest.origin || 'input/translated';
  }

  if (manifest.currentVersion > 0) {
    return `input-fixed/v${manifest.currentVersion}`;
  }

  return manifest.origin || 'input/translated';
}

export function buildEpubVersionWorkflow(manifest, translationPath) {
  const versions = (manifest.versions || []).map((item) => item.version).filter(Number.isFinite);
  const currentVersion = Number(manifest.currentVersion || (versions.length ? Math.max(...versions) : 0));
  const workingInput = detectWorkingInput(translationPath, manifest);
  const origin = manifest.origin || 'input/translated';

  return {
    workingInput,
    currentVersion,
    nextVersion: currentVersion + 1,
    origin,
    finalOutput: manifest.finalOutput || 'output',
    flow: [
      'input/translated',
      ...versions.map((version) => `v${version}`),
      'output',
    ],
    manifest,
  };
}

export function buildEpubWorkflowTrace(workflowRoot, manifest, translationFilename) {
  const traceVersions = [];
  const fixedRoot = path.join(workflowRoot, 'input-fixed');

  if (fs.existsSync(fixedRoot)) {
    traceVersions.push(
      ...fs.readdirSync(fixedRoot).filter((name) => /^v\d+$/i.test(name)).sort(),
    );
  }

  const fileFlows = [{
    file: translationFilename,
    events: [
      {
        event: 'CORRECTION_SOURCE',
        source: `${manifest.origin || 'input/translated'}/${translationFilename}`,
        sourcePath: manifest.origin || 'input/translated',
        step: 0,
      },
      ...(manifest.versions || []).map((entry) => ({
        event: 'VERSION_FILE_PUBLISHED',
        version: `v${entry.version}`,
        destination: entry.output || `input-fixed/v${entry.version}`,
        step: entry.version,
        metadata: entry.metadata || {},
      })),
      {
        event: 'FINAL_OUTPUT_UPDATED',
        destination: manifest.finalOutput || 'output',
        version: manifest.currentVersion ? `v${manifest.currentVersion}` : null,
      },
    ],
  }];

  return {
    currentStep: manifest.currentVersion || null,
    versionsFound: traceVersions,
    versionsCreated: (manifest.versions || []).map((entry) => `v${entry.version}`),
    versionsMissing: [],
    writes: [],
    deletes: [],
    warnings: [],
    fileFlows,
  };
}

function getVersionInfo(report) {
  const workflow = report.versionWorkflow || {};
  const trace = report.workflowTrace || {};
  const flow = workflow.flow?.length
    ? [...workflow.flow]
    : [workflow.origin || 'input/translated'];
  const currentLabel = workflow.currentVersion ? `v${workflow.currentVersion}` : null;
  const currentNumber = Number(workflow.currentVersion || 0);
  const nextNumber = Math.max(Number(workflow.nextVersion || 0), currentNumber + 1, 1);

  if (currentLabel && !flow.includes(currentLabel)) flow.push(currentLabel);
  if (!flow.includes(`v${nextNumber}`)) flow.push(`v${nextNumber}`);

  return {
    workingInput: workflow.workingInput || 'desconhecida',
    currentVersion: workflow.currentVersion ? `v${workflow.currentVersion}` : 'nenhuma',
    nextVersion: `v${nextNumber}`,
    flow,
    overwritten: (trace.writes || []).some((event) => event.overwrite),
  };
}

function shortPath(filePath = '') {
  const normalized = String(filePath).replaceAll('\\', '/');
  const parts = normalized.split('/').filter(Boolean);
  const interesting = ['input', 'input-fixed', 'output'];
  const start = parts.findIndex((part) => interesting.includes(part));

  return start >= 0 ? parts.slice(start).join('/') : normalized;
}

function basename(filePath = '') {
  const normalized = String(filePath).replaceAll('\\', '/');
  const parts = normalized.split('/').filter(Boolean);

  return parts.at(-1) || normalized;
}

function dirname(filePath = '') {
  const normalized = shortPath(filePath);
  const index = normalized.lastIndexOf('/');

  return index >= 0 ? normalized.slice(0, index) : normalized;
}

function stageFromEvent(event, firstSource) {
  if (event.event === 'VERSION_FILE_PUBLISHED') {
    return {
      className: 'version',
      title: `✅ ${event.version || 'Versão'} publicada`,
      meta: 'snapshot versionado EPUB',
      file: dirname(event.destination),
      chain: dirname(event.destination),
    };
  }

  if (event.event === 'FINAL_OUTPUT_UPDATED') {
    return {
      className: 'current',
      title: '📤 Output final',
      meta: 'arquivo final para leitura',
      file: dirname(event.destination),
      chain: dirname(event.destination),
    };
  }

  return {
    className: 'origin',
    title: '📂 Origem',
    meta: shortPath(firstSource || event.source || event.sourcePath || ''),
    file: basename(firstSource || event.source || ''),
    chain: shortPath(firstSource || event.source || event.sourcePath || ''),
  };
}

function renderFlowSteps(steps) {
  return steps.map((step, index) => `
    ${index > 0 ? '<div class="flow-arrow">-&gt;</div>' : ''}
    <div class="flow-step ${step.className}">
      <div class="flow-step-title">${escapeHtml(step.title)}</div>
      <div class="flow-step-meta">${escapeHtml(step.meta)}</div>
      <div class="flow-step-file">${escapeHtml(step.file)}</div>
    </div>`).join('');
}

function renderFlowChain(steps) {
  return `
    <div class="flow-chain">
      ${steps.map((step, index) => `
        ${index > 0 ? '<div class="flow-chain-arrow">-&gt;</div>' : ''}
        <div class="flow-node">${escapeHtml(step.chain || step.file || step.title)}</div>`).join('')}
    </div>`;
}

function renderVersionTimeline(report) {
  const fileFlows = report.workflowTrace?.fileFlows || [];

  if (fileFlows.length) {
    return fileFlows.map((flow) => {
      const sourceEvent = flow.events.find((event) => event.event === 'CORRECTION_SOURCE');
      const firstSource = flow.events.find((event) => event.source)?.source || sourceEvent?.sourcePath;
      const steps = [
        stageFromEvent({ event: 'CORRECTION_SOURCE' }, firstSource),
        ...flow.events
          .filter((event) => event.event !== 'CORRECTION_SOURCE')
          .map((event) => stageFromEvent(event, firstSource)),
      ];

      return `
        <div class="version-file-flow">
          <div class="version-file-name">${escapeHtml(flow.file)}</div>
          <div class="version-timeline">${renderFlowSteps(steps)}</div>
          ${renderFlowChain(steps)}
        </div>`;
    }).join('');
  }

  const version = getVersionInfo(report);
  const steps = version.flow.map((node, index) => ({
    className: index === 0 ? 'origin' : index === version.flow.length - 1 ? 'version' : 'current',
    title: node,
    meta: index === 0 ? 'tradução inicial' : index === version.flow.length - 1 ? 'próxima esperada' : 'etapa atual',
    file: node,
    chain: node,
  }));

  return `
    <div class="version-file-flow">
      <div class="version-timeline">${renderFlowSteps(steps)}</div>
      ${renderFlowChain(steps)}
    </div>`;
}

function buildCompareRows(report, previousReport) {
  const rows = [
    {
      metric: 'Issues críticas',
      before: previousReport?.stats?.failIssues,
      after: report.stats.failIssues,
      reading: report.stats.failIssues > 0 ? 'Ainda há bloqueios para revisar.' : 'Nenhuma issue crítica restante.',
      kind: 'issues',
    },
    {
      metric: 'Warnings',
      before: previousReport?.stats?.totalWarnings,
      after: report.stats.totalWarnings,
      reading: 'Alertas da auditoria EPUB.',
      kind: 'warnings',
    },
    {
      metric: 'Seções original',
      before: previousReport?.stats?.sourceSections,
      after: report.stats.sourceSections,
      reading: 'Quantidade de seções textuais no EPUB de origem.',
      kind: 'sections',
    },
    {
      metric: 'Seções tradução',
      before: previousReport?.stats?.translatedSections,
      after: report.stats.translatedSections,
      reading: 'Quantidade de seções textuais no EPUB traduzido.',
      kind: 'sections',
    },
  ];

  const warningTypes = [
    ...new Set([
      ...(previousReport?.warnings || []),
      ...(report?.warnings || []),
    ].map((item) => item.type)),
  ];

  for (const type of warningTypes) {
    rows.push({
      metric: `Warning: ${type}`,
      before: sumIssueOccurrences(previousReport, (issue) => issue.type === type),
      after: sumIssueOccurrences(report, (issue) => issue.type === type),
      reading: 'Comparativo por tipo de alerta EPUB.',
      kind: 'warningType',
      type,
    });
  }

  const genderDescriptions = [
    ...new Set([
      ...(previousReport?.issues || []),
      ...(previousReport?.warnings || []),
      ...(report?.issues || []),
      ...(report?.warnings || []),
    ]
      .filter((issue) => issue.type === 'epub_gender_suspicion')
      .map((issue) => issue.description || issue.type)),
  ];

  for (const description of genderDescriptions) {
    rows.push({
      metric: `Suspeita de gênero: ${description}`,
      before: getIssueOccurrence(previousReport, description),
      after: getIssueOccurrence(report, description),
      reading: 'Comparativo de padrões de concordância.',
      kind: 'gender',
      description,
    });
  }

  return rows;
}

function buildCompareDetail(row, report, previousReport) {
  const delta = getDeltaValue(row.before, row.after);
  const trend = getTrendLabel(row.before, row.after);
  const status = delta === null ? 'INFO' : delta > 0 ? 'FAIL' : delta < 0 ? 'OK' : 'WARN';
  const evidence = [
    `Antes: ${row.before === null || row.before === undefined ? 'sem base' : formatNumber(row.before)}.`,
    `Depois: ${formatNumber(row.after)}.`,
    `Delta: ${delta === null ? 'sem base' : `${delta > 0 ? '+' : ''}${formatNumber(delta)}`}.`,
    `Relatório atual: ${report.stats?.timestamp || 'sem timestamp'}.`,
  ];

  if (previousReport?.stats?.timestamp) {
    evidence.push(`Relatório comparado: ${previousReport.stats.timestamp}.`);
  }

  const actions = {
    issues: [
      'Abrir Issues e warnings para ver quais itens sustentam o FAIL.',
      'Corrigir o EPUB e gerar nova versão em input-fixed/vN.',
      'Rodar nova auditoria para confirmar queda.',
    ],
    warnings: [
      'Separar falso positivo de problema real nos exemplos.',
      'Ajustar checks.js se o padrão gerar ruído recorrente.',
    ],
    gender: [
      'Validar exemplos antes de criar regra automática de correção.',
      'Priorizar ocorrências com contexto claramente incorreto.',
    ],
  };

  return renderDetailPanel({
    title: row.metric,
    status,
    evidence,
    interpretation: `${trend}. ${row.reading}`,
    actions: actions[row.kind] || ['Revisar dados brutos e decidir a próxima ação.'],
    raw: row,
  });
}

function renderCompareTable(report, previousReport) {
  return buildCompareRows(report, previousReport).map((row, index) => {
    const delta = formatDelta(row.before, row.after);
    const before = row.before === null || row.before === undefined ? '-' : formatNumber(row.before);

    return `
      <tr class="expandable-row" data-detail="compare-${index}">
        <td><button class="row-toggle" type="button" aria-expanded="false">+</button>${escapeHtml(row.metric)}</td>
        <td>${before}</td>
        <td>${formatNumber(row.after)}</td>
        <td class="${delta.className}">${delta.text}</td>
        <td>${escapeHtml(row.reading)}</td>
      </tr>
      <tr class="detail-row" id="compare-${index}">
        <td colspan="5">${buildCompareDetail(row, report, previousReport)}</td>
      </tr>`;
  }).join('');
}

function buildDiagnostics(report, previousReport) {
  const diagnostics = [];
  const workingInput = report.versionWorkflow?.workingInput || '';
  const sectionDiff = Math.abs(
    Number(report.stats?.sourceSections || 0) - Number(report.stats?.translatedSections || 0),
  );

  diagnostics.push({
    status: workingInput.includes('input-fixed') ? 'ok' : 'warn',
    title: workingInput.includes('input-fixed')
      ? 'Auditoria usa versão corrigida.'
      : 'Auditoria ainda usa a tradução inicial.',
    detail: `Alvo registrado: ${workingInput || 'desconhecido'}.`,
    actions: workingInput.includes('input-fixed')
      ? ['Continuar correções a partir da versão mais recente em input-fixed/vN.']
      : ['Gerar versão corrigida com fixEpub para auditar input-fixed/vN.'],
  });

  diagnostics.push({
    status: report.logInput?.exists ? 'ok' : 'warn',
    title: report.logInput?.exists ? 'Log_Traducao.txt encontrado.' : 'Log de tradução ausente.',
    detail: report.logInput?.exists
      ? `${formatNumber(report.logInput.terms?.length || 0)} termos · ${formatNumber(report.logInput.replacements?.length || 0)} trocas.`
      : 'A auditoria segue sem regras declaradas no log.',
    actions: report.logInput?.exists
      ? ['Conferir se termos e trocas do log foram aplicados no EPUB.']
      : ['Adicionar Log_Traducao.txt em input/logs para validação auxiliar.'],
  });

  diagnostics.push({
    status: sectionDiff === 0 ? 'ok' : sectionDiff <= 2 ? 'warn' : 'fail',
    title: sectionDiff === 0 ? 'Seções pareadas em quantidade.' : 'Diferença de seções entre original e tradução.',
    detail: `Original: ${formatNumber(report.stats?.sourceSections)} · Tradução: ${formatNumber(report.stats?.translatedSections)}.`,
    actions: sectionDiff > 0
      ? ['Abrir Inventário de seções e localizar missing/extra.', 'Revisar divisão de capítulos no EPUB traduzido.']
      : ['Nenhuma ação imediata necessária.'],
  });

  const brokenSentence = sumIssueOccurrences(report, (issue) => issue.type === 'epub_possible_broken_sentence');
  if (brokenSentence > 0) {
    diagnostics.push({
      status: brokenSentence > 1000 ? 'warn' : 'info',
      title: 'Detector de frases quebradas com alto volume.',
      detail: `${formatNumber(brokenSentence)} ocorrências. URLs e notas podem inflar o número.`,
      actions: [
        'Validar amostras antes de tratar como erro estrutural.',
        'Ajustar o limiar em checks.js se for ruído recorrente.',
      ],
    });
  }

  const previousWarnings = previousReport?.stats?.totalWarnings;
  const currentWarnings = report.stats?.totalWarnings || 0;
  diagnostics.push({
    status: previousWarnings === undefined || currentWarnings <= previousWarnings ? 'ok' : 'warn',
    title: previousWarnings === undefined
      ? 'Primeira auditoria registrada.'
      : currentWarnings < previousWarnings
        ? 'Warnings reduziram em relação à execução anterior.'
        : 'Warnings aumentaram em relação à execução anterior.',
    detail: previousWarnings === undefined
      ? `${formatNumber(currentWarnings)} warnings nesta execução.`
      : `Antes: ${formatNumber(previousWarnings)} · depois: ${formatNumber(currentWarnings)}.`,
    actions: ['Usar Comparativo antes/depois para priorizar tipos de alerta.'],
  });

  return diagnostics;
}

function renderDiagnostics(report, previousReport) {
  return buildDiagnostics(report, previousReport).map((item) => `
    <details class="diagnostic">
      <summary>
        <span class="status ${statusClass(item.status)}">${escapeHtml(item.status.toUpperCase())}</span>
        <span>
          <strong>${escapeHtml(item.title)}</strong>
          <span class="small">${escapeHtml(item.detail)}</span>
        </span>
      </summary>
      ${renderDetailPanel({
        title: item.title,
        status: item.status,
        evidence: [item.detail],
        interpretation: 'Diagnóstico inferido a partir dos contadores e do manifest EPUB.',
        actions: item.actions || ['Revisar dados brutos e decidir a próxima ação.'],
        raw: item,
      })}
    </details>`).join('');
}

function renderIssueRows(items) {
  if (!items.length) {
    return '<tr><td colspan="4" class="small">Nenhuma ocorrência nesta categoria.</td></tr>';
  }

  return items.map((item, index) => `
    <tr class="expandable-row" data-detail="issue-${index}">
      <td>${statusBadge(item.severity || 'WARN')}</td>
      <td>${escapeHtml(item.type)}</td>
      <td><button class="row-toggle" type="button" aria-expanded="false">+</button>${escapeHtml(item.description)}</td>
      <td>${formatNumber(item.occurrences || 1)}</td>
    </tr>
    <tr class="detail-row" id="issue-${index}">
      <td colspan="4">${renderDetailPanel({
        title: item.description || item.type,
        status: item.severity || 'WARN',
        evidence: [
          `Tipo: ${item.type || 'sem tipo'}.`,
          `Ocorrências: ${formatNumber(item.occurrences || 1)}.`,
          `Severidade: ${item.severity || 'WARN'}.`,
        ],
        interpretation: item.type === 'epub_gender_suspicion'
          ? 'Possível discordância de gênero; confirme nos exemplos antes de corrigir em massa.'
          : item.type === 'epub_possible_broken_sentence'
            ? 'Ponto seguido de minúscula pode ser quebra real ou ruído de URL/nota.'
            : 'Sinal estrutural ou de conteúdo que merece triagem.',
        actions: item.type === 'epub_gender_suspicion'
          ? [
            'Validar se a ocorrência é erro real.',
            'Criar regra de correção somente depois de confirmar o padrão.',
          ]
          : [
            'Conferir se o warning afeta leitura ou estrutura.',
            'Ajustar detector se for falso positivo recorrente.',
          ],
        examples: item.examples || [],
        raw: item,
      })}</td>
    </tr>`).join('');
}

function renderSnapshotMetrics(report) {
  if (!report) {
    return '<div class="empty-tab">Nenhuma auditoria disponível para esta aba ainda.</div>';
  }

  const version = getVersionInfo(report);

  return `
    <div class="grid grid-4">
      <div class="card">
        <div class="metric-label">Status</div>
        <div class="metric-value">${statusBadge(report.status)}</div>
        <div class="metric-note">${formatNumber(report.stats?.failIssues || 0)} issues críticas.</div>
      </div>
      <div class="card">
        <div class="metric-label">Origem auditada</div>
        <div class="metric-value" style="font-size:18px">${escapeHtml(version.workingInput)}</div>
        <div class="metric-note">${escapeHtml(report.stats?.timestamp || 'sem timestamp')}</div>
      </div>
      <div class="card">
        <div class="metric-label">Warnings</div>
        <div class="metric-value">${formatNumber(report.stats?.totalWarnings || 0)}</div>
        <div class="metric-note">Alertas operacionais.</div>
      </div>
      <div class="card">
        <div class="metric-label">Seções</div>
        <div class="metric-value">${formatNumber(report.stats?.sourceSections || 0)} / ${formatNumber(report.stats?.translatedSections || 0)}</div>
        <div class="metric-note">Original / tradução.</div>
      </div>
    </div>`;
}

function renderSnapshotIssues(report) {
  const rows = [...(report?.issues || []), ...(report?.warnings || [])];

  if (!report || !rows.length) return '<div class="empty-tab">Nenhuma issue ou warning nesta auditoria.</div>';

  return `
    <div class="card compact-table-card">
      <table>
        <thead>
          <tr>
            <th>Status</th>
            <th>Tipo</th>
            <th>Descrição</th>
            <th>Ocorrências</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((item) => `
            <tr>
              <td>${statusBadge(item.severity || 'WARN')}</td>
              <td>${escapeHtml(item.type || '-')}</td>
              <td>${escapeHtml(item.description || '-')}</td>
              <td>${formatNumber(item.occurrences || 1)}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function renderReportSnapshot(report) {
  return `
    ${renderSnapshotMetrics(report)}
    <section>
      <div class="section-title">
        <div>
          <h2>Issues e warnings</h2>
          <p>Resumo desta origem auditada.</p>
        </div>
      </div>
      ${renderSnapshotIssues(report)}
    </section>`;
}

function renderCompareSnapshotRows(report, previousReport) {
  if (!report) return '<tr><td colspan="5">Sem dados para comparar.</td></tr>';

  return buildCompareRows(report, previousReport).map((row) => {
    const delta = formatDelta(row.before, row.after);
    const before = row.before === null || row.before === undefined ? '-' : formatNumber(row.before);

    return `
      <tr>
        <td>${escapeHtml(row.metric)}</td>
        <td>${before}</td>
        <td>${formatNumber(row.after)}</td>
        <td class="${delta.className}">${delta.text}</td>
        <td>${escapeHtml(row.reading)}</td>
      </tr>`;
  }).join('');
}

function renderTabbedOverview({ sourceReport, currentReport }) {
  const compareBase = currentReport || sourceReport;
  const comparePrevious = sourceReport && currentReport && sourceReport !== currentReport
    ? sourceReport
    : null;

  return `
    <section class="dashboard-tabs">
      <div class="tab-list" role="tablist" aria-label="Visões do relatório">
        <button class="tab-button active" type="button" data-tab="tab-source">Tradução inicial</button>
        <button class="tab-button" type="button" data-tab="tab-current">Versão corrigida</button>
        <button class="tab-button" type="button" data-tab="tab-compare">Comparativo</button>
      </div>

      <div class="tab-panel active" id="tab-source">
        ${renderReportSnapshot(sourceReport)}
      </div>

      <div class="tab-panel" id="tab-current">
        ${renderReportSnapshot(currentReport)}
      </div>

      <div class="tab-panel" id="tab-compare">
        <div class="card">
          <table>
            <thead>
              <tr>
                <th>Métrica</th>
                <th>Antes</th>
                <th>Depois</th>
                <th>Delta</th>
                <th>Leitura</th>
              </tr>
            </thead>
            <tbody>${renderCompareSnapshotRows(compareBase, comparePrevious)}</tbody>
          </table>
        </div>
      </div>
    </section>`;
}

function renderLogInputs(report, relativeWorkflowPath) {
  const terms = report.logInput?.terms?.length
    ? report.logInput.terms.map((term) => `<span class="status info">${escapeHtml(term)}</span>`).join(' ')
    : '<span class="small">Nenhum termo informado.</span>';
  const replacements = report.logInput?.replacements?.length
    ? report.logInput.replacements.map((item) => `<li><code>${escapeHtml(item.from)}</code> → <code>${escapeHtml(item.to)}</code></li>`).join('')
    : '<li class="small">Nenhuma troca informada.</li>';

  return `
    <section>
      <div class="section-title">
        <div>
          <h2>Insumos do Log_Traducao.txt</h2>
          <p>Bloco inicial usado como regra auxiliar da auditoria EPUB.</p>
        </div>
      </div>
      <div class="card">
        <div>${terms}</div>
        <h3 style="margin-top:18px">Trocas declaradas</h3>
        <ul>${replacements}</ul>
        <div class="small">Arquivo: ${escapeHtml(relativeWorkflowPath(report.logInput?.file))}</div>
      </div>
    </section>`;
}

function renderSectionInventory(report) {
  const chapters = report.epubAudit?.alignment || [];

  return `
    <section>
      <div class="section-title">
        <div>
          <h2>Inventário de seções</h2>
          <p>Pareamento textual usado para comparar original e tradução.</p>
        </div>
      </div>
      <details>
        <summary>Ver até 80 seções pareadas</summary>
        <div class="card">
          <table>
            <thead>
              <tr>
                <th>Match</th>
                <th>Original</th>
                <th>Tradução</th>
                <th>Chars original</th>
                <th>Chars tradução</th>
                <th>Confiança</th>
              </tr>
            </thead>
            <tbody>
              ${chapters.slice(0, 80).map((chapter) => `
                <tr>
                  <td>${escapeHtml(chapter.matchType || '-')}</td>
                  <td>${escapeHtml(chapter.sourceTitle || '-')}</td>
                  <td>${escapeHtml(chapter.translationTitle || '-')}</td>
                  <td>${formatNumber(chapter.sourceCharCount)}</td>
                  <td>${formatNumber(chapter.translationCharCount)}</td>
                  <td>${escapeHtml(String(chapter.confidence ?? '-'))}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </details>
    </section>`;
}

function renderNotApplicableSection(title, description) {
  return `
    <section>
      <div class="section-title">
        <div>
          <h2>${escapeHtml(title)}</h2>
          <p>${escapeHtml(description)}</p>
        </div>
      </div>
      <div class="card">
        <div class="small">Não aplicável neste workflow EPUB.</div>
      </div>
    </section>`;
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
  };
}

function renderCorrectionRows(corrections = []) {
  if (!corrections.length) {
    return '<tr><td colspan="8">Nenhuma correção aplicada registrada.</td></tr>';
  }

  return corrections.slice(0, 80).map((item) => `
    <tr>
      <td>${escapeHtml(item.type || '-')}</td>
      <td>${escapeHtml(item.source || '-')}</td>
      <td><code>${escapeHtml(item.before || '-')}</code></td>
      <td><code>${escapeHtml(item.after || '-')}</code></td>
      <td>${escapeHtml(item.filePath || '-')}</td>
      <td>${escapeHtml(item.nodeId || '-')}</td>
      <td>${escapeHtml(String(item.confidence ?? '-'))}</td>
      <td>${formatNumber(item.replacements || 0)}</td>
    </tr>`).join('');
}

function renderSkippedActionRows(actions = []) {
  if (!actions.length) {
    return '<tr><td colspan="7">Nenhuma ação ignorada registrada.</td></tr>';
  }

  return actions.slice(0, 80).map((item) => `
    <tr>
      <td>${escapeHtml(item.actionId || '-')}</td>
      <td>${escapeHtml(item.type || '-')}</td>
      <td>${escapeHtml(item.mode || '-')}</td>
      <td>${escapeHtml(item.source || '-')}</td>
      <td>${escapeHtml(item.status || '-')}</td>
      <td>${escapeHtml(item.reason || '-')}</td>
      <td>${escapeHtml(item.candidateId || '-')}</td>
    </tr>`).join('');
}

function renderValidationSummary(postValidation) {
  if (!postValidation) {
    return '<div class="small">Sem validação pós-correção registrada.</div>';
  }

  const packageValidation = postValidation.packageValidation || {};
  const textComparison = postValidation.textComparison || {};
  const correctionValidation = postValidation.correctionValidation || {};

  return `
    <div class="grid grid-4">
      <div class="card">
        <div class="metric-label">Validação EPUB</div>
        <div class="metric-value">${statusBadge(postValidation.status || 'UNKNOWN')}</div>
        <div class="metric-note">ZIP, mimetype, container, OPF, manifest e spine.</div>
      </div>
      <div class="card">
        <div class="metric-label">Mudança textual</div>
        <div class="metric-value">${textComparison.textChanged ? 'sim' : 'não'}</div>
        <div class="metric-note">Delta chars: ${formatNumber(textComparison.charDelta || 0)}.</div>
      </div>
      <div class="card">
        <div class="metric-label">Correções confirmadas</div>
        <div class="metric-value">${formatNumber(correctionValidation.confirmedCorrections || 0)} / ${formatNumber(correctionValidation.appliedCorrections || 0)}</div>
        <div class="metric-note">Presença confirmada no texto final.</div>
      </div>
      <div class="card">
        <div class="metric-label">Spine/manifest</div>
        <div class="metric-value">${packageValidation.manifestValid && packageValidation.spineValid ? 'OK' : 'WARN'}</div>
        <div class="metric-note">${formatNumber(packageValidation.manifestItems || 0)} itens manifest · ${formatNumber(packageValidation.spineItems || 0)} spine.</div>
      </div>
    </div>`;
}

function renderReauditSummary(reauditoriaSummary) {
  if (!reauditoriaSummary) {
    return '<div class="small">Sem reauditoria automática registrada.</div>';
  }

  return `
    <div class="grid grid-4">
      <div class="card">
        <div class="metric-label">Status final</div>
        <div class="metric-value">${escapeHtml(reauditoriaSummary.result || 'unknown')}</div>
        <div class="metric-note">improvement/regression/neutral/unknown.</div>
      </div>
      <div class="card">
        <div class="metric-label">Issues</div>
        <div class="metric-value">${formatNumber(reauditoriaSummary.issuesBefore || 0)} → ${formatNumber(reauditoriaSummary.issuesAfter || 0)}</div>
        <div class="metric-note">Antes/depois da correção.</div>
      </div>
      <div class="card">
        <div class="metric-label">Warnings</div>
        <div class="metric-value">${formatNumber(reauditoriaSummary.warningsBefore || 0)} → ${formatNumber(reauditoriaSummary.warningsAfter || 0)}</div>
        <div class="metric-note">Antes/depois da correção.</div>
      </div>
      <div class="card">
        <div class="metric-label">Candidates</div>
        <div class="metric-value">${formatNumber(reauditoriaSummary.correctionCandidatesBefore || 0)} → ${formatNumber(reauditoriaSummary.correctionCandidatesAfter || 0)}</div>
        <div class="metric-note">${formatNumber(reauditoriaSummary.appliedCorrections || 0)} correções aplicadas.</div>
      </div>
    </div>`;
}

function renderReviewQueueRows(reviewQueue) {
  const items = reviewQueue?.items || [];
  if (!items.length) {
    return '<tr><td colspan="8">Nenhum item pendente de revisão.</td></tr>';
  }

  return items.slice(0, 80).map((item) => `
    <tr>
      <td>${escapeHtml(item.status || 'pending')}</td>
      <td>${escapeHtml(item.type || '-')}</td>
      <td>${escapeHtml(item.filePath || '-')}</td>
      <td>${escapeHtml(item.nodeId || '-')}</td>
      <td>${escapeHtml(String(item.confidence ?? '-'))}</td>
      <td>${escapeHtml(item.notAppliedReason || item.reason || '-')}</td>
      <td>${escapeHtml([
        item.previousParagraph ? `Anterior: ${item.previousParagraph}` : null,
        item.currentParagraph ? `Atual: ${item.currentParagraph}` : null,
        item.nextParagraph ? `Posterior: ${item.nextParagraph}` : null,
        item.originalAlignedText ? `Original: ${item.originalAlignedText}` : null,
      ].filter(Boolean).join(' | ') || '-')}</td>
      <td>${escapeHtml(item.textPreview || '-')}</td>
    </tr>`).join('');
}

function renderReviewQueueSummary(reviewQueue) {
  const summary = reviewQueue?.summary || {};

  return `
    <h3>Fila de revisão</h3>
    <div class="grid grid-4">
      <div class="card">
        <div class="metric-label">Itens</div>
        <div class="metric-value">${formatNumber(summary.totalItems || 0)}</div>
        <div class="metric-note">auto_review/manual_only.</div>
      </div>
      <div class="card">
        <div class="metric-label">Pending</div>
        <div class="metric-value">${formatNumber(summary.pending || 0)}</div>
        <div class="metric-note">Aguardando decisão.</div>
      </div>
      <div class="card">
        <div class="metric-label">Needs context</div>
        <div class="metric-value">${formatNumber(summary.needsContext || 0)}</div>
        <div class="metric-note">${formatNumber(summary.contextEnriched || 0)} com contexto expandido.</div>
      </div>
      <div class="card">
        <div class="metric-label">Approved / rejected</div>
        <div class="metric-value">${formatNumber(summary.approved || 0)} / ${formatNumber(summary.rejected || 0)}</div>
        <div class="metric-note">Preparado para aprovação manual futura.</div>
      </div>
    </div>
    <div class="card compact-table-card">
      <table>
        <thead>
          <tr>
            <th>Status</th>
            <th>Tipo</th>
            <th>Arquivo</th>
            <th>Node</th>
            <th>Confiança</th>
            <th>Motivo</th>
            <th>Contexto</th>
            <th>Preview</th>
          </tr>
        </thead>
        <tbody>${renderReviewQueueRows(reviewQueue)}</tbody>
      </table>
    </div>`;
}

function renderAssistedReviewRows(assistedReview) {
  const suggestions = assistedReview?.suggestions || [];
  if (!suggestions.length) {
    return '<tr><td colspan="10">Nenhuma sugestão assistida gerada.</td></tr>';
  }

  return suggestions.slice(0, 80).map((item) => `
    <tr>
      <td>${escapeHtml(item.reviewQueueItemId || '-')}</td>
      <td>${escapeHtml(item.suggestionStatus || '-')}</td>
      <td>${escapeHtml(item.type || '-')}</td>
      <td>${escapeHtml(item.filePath || '-')}</td>
      <td>${escapeHtml(item.nodeId || '-')}</td>
      <td>${escapeHtml(String(item.confidence ?? '-'))}</td>
      <td>${escapeHtml(item.before || '-')}</td>
      <td>${escapeHtml(item.suggestedAfter || '-')}</td>
      <td>${escapeHtml([
        item.previousParagraph ? `Anterior: ${item.previousParagraph}` : null,
        item.currentParagraph ? `Atual: ${item.currentParagraph}` : null,
        item.nextParagraph ? `Posterior: ${item.nextParagraph}` : null,
        item.originalAlignedText ? `Original: ${item.originalAlignedText}` : null,
      ].filter(Boolean).join(' | ') || '-')}</td>
      <td>${escapeHtml(item.reason || '-')}</td>
    </tr>`).join('');
}

function renderAssistedReviewSummary(assistedReview) {
  const summary = assistedReview?.summary || {};

  return `
    <h3>Sugestões assistidas</h3>
    <div class="grid grid-4">
      <div class="card">
        <div class="metric-label">Sugestões</div>
        <div class="metric-value">${formatNumber(summary.totalSuggestions || 0)}</div>
        <div class="metric-note">Apenas pending + auto_review.</div>
      </div>
      <div class="card">
        <div class="metric-label">Aprovação humana</div>
        <div class="metric-value">${formatNumber(summary.requiresHumanApproval || 0)}</div>
        <div class="metric-note">${formatNumber(summary.contextEnriched || 0)} com contexto expandido.</div>
      </div>
      <div class="card">
        <div class="metric-label">Com suggestedAfter</div>
        <div class="metric-value">${formatNumber(summary.withSuggestedAfter || 0)}</div>
        <div class="metric-note">${formatNumber(summary.suggestionAvailable || 0)} suggestion_available.</div>
      </div>
      <div class="card">
        <div class="metric-label">Sem sugestão explícita</div>
        <div class="metric-value">${formatNumber((summary.needsHumanTranslation || 0) + (summary.insufficientContext || 0))}</div>
        <div class="metric-note">${formatNumber(summary.insufficientContext || 0)} insufficient_context.</div>
      </div>
    </div>
    <div class="card compact-table-card">
      <table>
        <thead>
          <tr>
            <th>Review item</th>
            <th>Status</th>
            <th>Tipo</th>
            <th>Arquivo</th>
            <th>Node</th>
            <th>Confiança</th>
            <th>Before</th>
            <th>Suggested after</th>
            <th>Contexto</th>
            <th>Motivo</th>
          </tr>
        </thead>
        <tbody>${renderAssistedReviewRows(assistedReview)}</tbody>
      </table>
    </div>`;
}

function renderCorrectionsSection(artifacts) {
  const correctionReport = artifacts.correctionReport || {};
  const applied = correctionReport.appliedCorrections || [];
  const skipped = correctionReport.skippedActions || [];

  return `
    <section>
      <div class="section-title">
        <div>
          <h2>Correções aplicadas e pendentes</h2>
          <p>Rastreabilidade do correction-report, validação pós-correção e reauditoria automática.</p>
        </div>
      </div>

      <div class="grid grid-4">
        <div class="card">
          <div class="metric-label">Aplicadas</div>
          <div class="metric-value">${formatNumber(applied.length)}</div>
          <div class="metric-note">Somente actions auto_safe.</div>
        </div>
        <div class="card">
          <div class="metric-label">Ignoradas</div>
          <div class="metric-value">${formatNumber(skipped.length)}</div>
          <div class="metric-note">auto_review/manual_only não aplicadas.</div>
        </div>
        <div class="card">
          <div class="metric-label">Validação</div>
          <div class="metric-value">${statusBadge(artifacts.postValidation?.status || 'UNKNOWN')}</div>
          <div class="metric-note">post-correction-validation.json.</div>
        </div>
        <div class="card">
          <div class="metric-label">Resultado final</div>
          <div class="metric-value">${escapeHtml(artifacts.reauditoriaSummary?.result || 'unknown')}</div>
          <div class="metric-note">reauditoria-summary.json.</div>
        </div>
      </div>

      <h3>Correções aplicadas</h3>
      <div class="card compact-table-card">
        <table>
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Origem</th>
              <th>Before</th>
              <th>After</th>
              <th>Arquivo</th>
              <th>Node</th>
              <th>Confiança</th>
              <th>Trocas</th>
            </tr>
          </thead>
          <tbody>${renderCorrectionRows(applied)}</tbody>
        </table>
      </div>

      <h3>Ações ignoradas</h3>
      <div class="card compact-table-card">
        <table>
          <thead>
            <tr>
              <th>Action</th>
              <th>Tipo</th>
              <th>Modo</th>
              <th>Origem</th>
              <th>Status</th>
              <th>Motivo</th>
              <th>Candidate</th>
            </tr>
          </thead>
          <tbody>${renderSkippedActionRows(skipped)}</tbody>
        </table>
      </div>

      ${renderReviewQueueSummary(artifacts.reviewQueue)}
      ${renderAssistedReviewSummary(artifacts.assistedReview)}

      <h3>Validação pós-correção</h3>
      ${renderValidationSummary(artifacts.postValidation)}

      <h3>Reauditoria antes/depois</h3>
      ${renderReauditSummary(artifacts.reauditoriaSummary)}
    </section>`;
}

function getEpubTabReports(logsDir, report) {
  const sourceReport = logsDir
    ? getLatestJsonReportByWorkingInput(logsDir, 'input/translated', report)
    : null;
  const currentReport = logsDir
    ? getLatestJsonReportByWorkingInput(logsDir, 'input-fixed/v', report)
    : null;

  return { sourceReport, currentReport };
}

export function writeEpubHtmlDashboard(report, htmlPath, {
  logsDir,
  sourceDocs = [],
  translatedDocs = [],
  alignedDocs = [],
  relativeWorkflowPath = (value) => value,
} = {}) {
  const previousReport = logsDir ? getLatestJsonReport(logsDir, report.stats?.timestamp) : null;
  const { sourceReport, currentReport } = getEpubTabReports(logsDir, report);
  const correctionArtifacts = loadCorrectionArtifacts(logsDir);
  const version = getVersionInfo(report);
  const fileLabel = [
    report.stats?.sourceFile,
    report.stats?.translatedFile,
  ].filter(Boolean).join(' · ') || 'sem arquivo';
  const diagnostics = buildDiagnostics(report, previousReport);
  const rawJson = JSON.stringify({
    status: report.status,
    workingSource: version.workingInput,
    currentVersion: version.currentVersion,
    nextVersion: version.nextVersion,
    stats: report.stats,
    logInput: report.logInput,
    entityConsistency: report.entityConsistency,
    diagnostics,
    issueTypes: [...new Set([
      ...(report.issues || []),
      ...(report.warnings || []),
    ].map((item) => item.type))],
  }, null, 2);

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Audit Dashboard - Extrair Novel</title>
  <style>${dashboardStyles}</style>
</head>
<body>
  <header>
    <h1>Audit Dashboard - audit-translation-epub</h1>
    <div class="subtitle">
      Arquivo: <strong>${escapeHtml(fileLabel)}</strong> · Execução: <strong>${escapeHtml(report.stats.timestamp)}</strong>
    </div>
  </header>

  <main>
    ${renderTabbedOverview({ sourceReport, currentReport })}

    <div class="grid grid-4">
      <div class="card">
        <div class="metric-label">Status consolidado</div>
        <div class="metric-value">${statusBadge(report.status)}</div>
        <div class="metric-note">${report.stats.failIssues > 0 ? 'Ainda existem issues críticas.' : 'Sem issues críticas detectadas.'}</div>
      </div>

      <div class="card">
        <div class="metric-label">Origem auditada</div>
        <div class="metric-value" style="font-size:20px">${escapeHtml(version.workingInput)}</div>
        <div class="metric-note">Origem usada nesta auditoria.</div>
      </div>

      <div class="card">
        <div class="metric-label">Versão atual</div>
        <div class="metric-value">${escapeHtml(version.currentVersion)}</div>
        <div class="metric-note">Próxima versão esperada: ${escapeHtml(version.nextVersion)}.</div>
      </div>

      <div class="card">
        <div class="metric-label">Arquivo final</div>
        <div class="metric-value" style="font-size:20px">output/</div>
        <div class="metric-note">${formatNumber(report.stats.sourceSections)} / ${formatNumber(report.stats.translatedSections)} seções.</div>
      </div>
    </div>

    <section>
      <div class="version-flow-card">
        <div class="version-flow-header">
          <div class="version-flow-title">
            Fluxo de versionamento
            <small>Cadeia evolutiva esperada da tradução EPUB.</small>
          </div>
          ${statusBadge(version.overwritten ? 'WARN' : 'OK', version.overwritten ? 'sobrescrita detectada' : 'leitura sequencial')}
        </div>
        <div class="version-flow-body">${renderVersionTimeline(report)}</div>
      </div>
    </section>

    <section>
      <div class="section-title">
        <div>
          <h2>Comparativo antes/depois</h2>
          <p>${previousReport ? `Comparado com ${escapeHtml(previousReport.stats?.timestamp || 'relatório anterior')}.` : 'Sem relatório anterior disponível para comparação.'}</p>
        </div>
      </div>
      <div class="card">
        <table>
          <thead>
            <tr>
              <th>Métrica</th>
              <th>Antes</th>
              <th>Depois</th>
              <th>Delta</th>
              <th>Leitura</th>
            </tr>
          </thead>
          <tbody>${renderCompareTable(report, previousReport)}</tbody>
        </table>
      </div>
    </section>

    ${renderLogInputs(report, relativeWorkflowPath)}
    ${renderSectionInventory(report)}
    ${renderNotApplicableSection('Consistência de entidades', 'Workflow EPUB não executa normalização de entidades DOCX.')}
    ${renderCorrectionsSection(correctionArtifacts)}

    <section>
      <div class="section-title">
        <div>
          <h2>Issues e warnings</h2>
          <p>Resumo operacional da auditoria atual.</p>
        </div>
      </div>
      <div class="card">
        <table>
          <thead>
            <tr>
              <th>Status</th>
              <th>Tipo</th>
              <th>Descrição</th>
              <th>Ocorrências</th>
            </tr>
          </thead>
          <tbody>${renderIssueRows([...(report.issues || []), ...(report.warnings || [])])}</tbody>
        </table>
      </div>
    </section>

    <section>
      <div class="section-title">
        <div>
          <h2>Diagnóstico automático</h2>
          <p>Conclusões objetivas a partir dos logs e do manifest EPUB.</p>
        </div>
      </div>
      <div class="card diagnostics">${renderDiagnostics(report, previousReport)}</div>
    </section>

    ${renderDocumentPreviews(sourceDocs, translatedDocs)}
    ${renderFileInventory(report.files || [])}
    ${renderProblematicChapters(alignedDocs, report.ollamaResults || [])}
    ${renderTechnicalTrace(report)}

    <section>
      <div class="section-title">
        <div>
          <h2>Dados brutos</h2>
          <p>Área recolhível para preservar informação sem poluir o relatório.</p>
        </div>
      </div>
      <details>
        <summary>Ver JSON resumido</summary>
        <pre>${escapeHtml(rawJson)}</pre>
      </details>
    </section>
  </main>

  <script>${dashboardScript}</script>
</body>
</html>
`;

  fs.writeFileSync(htmlPath, html, 'utf8');
}
