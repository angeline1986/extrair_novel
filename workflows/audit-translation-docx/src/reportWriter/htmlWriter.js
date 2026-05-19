// src/reportWriter/htmlWriter.js
// Relatório HTML consolidado e filtrável para auditoria.

import fs from 'fs';
import { dashboardScript, dashboardStyles } from './dashboard/assets.js';
import { getLatestJsonReport, getLatestNormalization } from './dashboard/dataSources.js';
import {
  renderDocumentPreviews,
  renderFileInventory,
  renderProblematicChapters,
  renderTechnicalTrace,
} from './dashboard/technicalSections.js';
import {
  escapeHtml,
  formatDelta,
  formatNumber,
  getDeltaValue,
  getTrendLabel,
  renderDetailPanel,
  statusBadge,
  statusClass,
} from './dashboard/htmlUtils.js';

function sumIssueOccurrences(report, predicate) {
  return (report?.issues || [])
    .filter(predicate)
    .reduce((sum, issue) => sum + Number(issue.occurrences || 1), 0);
}

function getIssueOccurrence(report, description) {
  return sumIssueOccurrences(
    report,
    (issue) => issue.description === description || issue.type === description
  );
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
      metric: 'Warnings estruturais',
      before: previousReport?.stats?.totalWarnings,
      after: report.stats.totalWarnings,
      reading: 'Ruído técnico da auditoria.',
      kind: 'warnings',
    },
    {
      metric: 'Aliases de entidades',
      before: previousReport?.entityConsistency?.totalAliasOccurrences,
      after: report.entityConsistency?.totalAliasOccurrences,
      reading: report.entityConsistency?.totalAliasOccurrences > 0
        ? 'Ainda há aliases pendentes.'
        : 'Entidades normalizadas.',
      kind: 'entities',
    },
    {
      metric: 'Tipos de alias',
      before: previousReport?.entityConsistency?.aliasesFound,
      after: report.entityConsistency?.aliasesFound,
      reading: 'Quantidade de variações canônicas detectadas.',
      kind: 'entityTypes',
    },
  ];

  const genderDescriptions = [
    ...new Set([
      ...(previousReport?.issues || []),
      ...(report?.issues || []),
    ]
      .filter((issue) => issue.type === 'gender_issue')
      .map((issue) => issue.description || issue.type)),
  ];

  for (const description of genderDescriptions) {
    rows.push({
      metric: `Gender issue: ${description}`,
      before: getIssueOccurrence(previousReport, description),
      after: getIssueOccurrence(report, description),
      reading: 'Comparativo específico do fix-gender.',
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

  if (row.kind === 'gender') {
    return renderDetailPanel({
      title: row.metric,
      status,
      evidence,
      interpretation: delta > 0
        ? 'A contagem aumentou depois do script. Isso pode ser regressão real, mas também pode ser efeito da normalização ter exposto mais padrões para o auditor encontrar.'
        : delta === 0
          ? 'A contagem não mudou. O fix-gender ainda não atacou esse padrão ou o detector está capturando falsos positivos.'
          : 'A contagem caiu. Ainda vale revisar exemplos se restarem ocorrências.',
      actions: [
        'Abrir os exemplos desta issue em Issues e warnings e confirmar se são erros reais.',
        'Se houver falso positivo, ajustar o padrão em gtPatterns para reduzir ruído.',
        'Se forem erros reais, criar regra específica no fix-gender para este padrão.',
        'Rodar nova auditoria e conferir se esta linha passa a cair.',
      ],
      raw: {
        trend,
        description: row.description,
        currentIssues: (report.issues || []).filter((issue) => issue.description === row.description),
        previousIssues: (previousReport?.issues || []).filter((issue) => issue.description === row.description),
      },
    });
  }

  const genericActions = {
    issues: [
      'Abrir Issues e warnings para ver quais itens sustentam o FAIL.',
      'Priorizar itens com severidade FAIL antes de gerar nova versão.',
      'Depois da correção, rodar reauditoria para confirmar queda.',
    ],
    warnings: [
      'Verificar se os warnings são ruído esperado ou problemas reais de estrutura.',
      'Se forem falsos positivos recorrentes, ajustar o detector.',
      'Se forem quebras reais, corrigir o DOCX atual antes da próxima versão.',
    ],
    entities: [
      'Abrir Consistência de entidades para ver aliases pendentes por personagem.',
      'Para cada pendência, decidir entre substituir, adicionar ao glossário, revisar manualmente ou ignorar como falso positivo.',
      'Rodar normalização novamente se a substituição for segura.',
    ],
    entityTypes: [
      'Tratar os aliases restantes um por vez, começando pelos de maior ocorrência.',
      'Adicionar aliases confiáveis ao glossário para evitar reincidência.',
      'Manter revisão manual quando o alias puder ser ambíguo.',
    ],
  };

  return renderDetailPanel({
    title: row.metric,
    status,
    evidence,
    interpretation: `${trend}. ${row.reading}`,
    actions: genericActions[row.kind] || ['Revisar dados brutos e decidir a próxima ação.'],
    raw: row,
  });
}

function renderCompareTable(report, previousReport) {
  const rows = buildCompareRows(report, previousReport);

  return rows.map((row, index) => {
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

function groupEntityIssues(entityConsistency) {
  const grouped = new Map();

  for (const issue of entityConsistency?.issues || []) {
    if (!grouped.has(issue.canonical)) grouped.set(issue.canonical, []);
    grouped.get(issue.canonical).push(issue);
  }

  return [...grouped.entries()].map(([canonical, issues]) => ({
    canonical,
    status: issues.length > 0 ? 'WARN' : 'OK',
    occurrences: issues.reduce((sum, issue) => sum + Number(issue.occurrences || 0), 0),
    aliases: issues,
  }));
}

function buildNormalizedEntityCards(normalization) {
  const replacements = normalization?.entityNormalization?.replacements || [];
  const grouped = new Map();

  for (const replacement of replacements) {
    if (!grouped.has(replacement.canonical)) grouped.set(replacement.canonical, []);
    grouped.get(replacement.canonical).push(replacement);
  }

  return [...grouped.entries()].map(([canonical, aliases]) => ({
    canonical,
    status: 'OK',
    occurrences: aliases.reduce((sum, alias) => sum + Number(alias.occurrences || 0), 0),
    aliases,
  }));
}

function renderEntityCards(report, normalization) {
  const pending = groupEntityIssues(report.entityConsistency);
  const normalized = buildNormalizedEntityCards(normalization);
  const cards = new Map();

  for (const item of normalized) cards.set(item.canonical, item);
  for (const item of pending) {
    const existing = cards.get(item.canonical);
    if (existing) {
      cards.set(item.canonical, {
        ...existing,
        status: 'WARN',
        pendingOccurrences: item.occurrences,
        aliases: [
          ...existing.aliases,
          ...item.aliases.map((alias) => ({
            alias: alias.found,
            occurrences: alias.occurrences,
            pending: true,
          })),
        ],
      });
    } else {
      cards.set(item.canonical, {
        canonical: item.canonical,
        status: 'WARN',
        occurrences: 0,
        pendingOccurrences: item.occurrences,
        aliases: item.aliases.map((alias) => ({
          alias: alias.found,
          occurrences: alias.occurrences,
          pending: true,
        })),
      });
    }
  }

  const items = [...cards.values()].sort((a, b) =>
    (b.occurrences + (b.pendingOccurrences || 0)) - (a.occurrences + (a.pendingOccurrences || 0))
  );

  if (!items.length) {
    return `
      <div class="card entity-card">
        <div class="entity-head">
          <h3>Nenhum alias pendente</h3>
          ${statusBadge('OK', 'OK')}
        </div>
        <div class="small">A auditoria não encontrou inconsistências em entidades protegidas.</div>
        <div class="bar"><div style="width:100%"></div></div>
      </div>`;
  }

  const maxOccurrences = Math.max(...items.map((item) => item.occurrences + (item.pendingOccurrences || 0)), 1);

  return items.map((item) => {
    const total = item.occurrences + (item.pendingOccurrences || 0);
    const width = Math.max(8, Math.round((total / maxOccurrences) * 100));
    const chips = item.aliases.slice(0, 8).map((alias) => {
      const label = `${alias.alias || alias.found} ${formatNumber(alias.occurrences)}${alias.pending ? ' pendente' : ''}`;
      return `<span class="chip">${escapeHtml(label)}</span>`;
    }).join('');

    return `
      <div class="card entity-card">
        <div class="entity-head">
          <h3>${escapeHtml(item.canonical)}</h3>
          ${statusBadge(item.status, item.status === 'WARN' ? 'Pendente' : 'Resolvido')}
        </div>
        <div class="small">${formatNumber(item.occurrences)} ocorrências corrigidas · ${formatNumber(item.pendingOccurrences || 0)} pendentes</div>
        <div class="bar"><div style="width:${width}%"></div></div>
        <div class="chips">${chips}</div>
        <details class="inline-detail">
          <summary>${item.status === 'WARN' ? 'Ver opções para pendência' : 'Ver detalhes das correções'}</summary>
          ${renderDetailPanel({
            title: item.status === 'WARN' ? `Pendências de ${item.canonical}` : `Correções de ${item.canonical}`,
            status: item.status,
            evidence: [
              `${formatNumber(item.occurrences)} ocorrências foram normalizadas.`,
              `${formatNumber(item.pendingOccurrences || 0)} ocorrências ainda aparecem como alias.`,
            ],
            interpretation: item.status === 'WARN'
              ? 'Há pelo menos uma forma alternativa ainda aparecendo no texto auditado.'
              : 'As variações conhecidas deste personagem foram tratadas pela normalização.',
            actions: item.status === 'WARN'
              ? [
                'Substituir automaticamente se o alias for inequivocamente o mesmo personagem.',
                'Adicionar o alias ao entityGlossary.json se ele deve ser reconhecido nas próximas execuções.',
                'Revisar manualmente se o nome puder depender do contexto.',
                'Ignorar como falso positivo somente se a ocorrência for válida no texto.',
              ]
              : [
                'Manter esses aliases no glossário para prevenir regressões.',
                'Se aparecerem variações novas, adicionar ao glossário e rodar nova normalização.',
              ],
            raw: item,
          })}
        </details>
      </div>`;
  }).join('');
}

function renderCorrectionsRows(report, normalization) {
  const rows = [];
  const changesByKey = new Map();

  for (const change of normalization?.changes || []) {
    changesByKey.set(`${change.canonical}::${change.alias}`, change);
  }

  for (const replacement of normalization?.entityNormalization?.replacements || []) {
    const change = changesByKey.get(`${replacement.canonical}::${replacement.alias}`);
    rows.push({
      status: 'ok',
      label: 'OK',
      alias: replacement.alias,
      canonical: replacement.canonical,
      occurrences: replacement.occurrences,
      action: 'replace_before_fix_gender',
      examples: change?.examples || [],
      raw: change || replacement,
    });
  }

  for (const issue of report.entityConsistency?.issues || []) {
    rows.push({
      status: 'warn',
      label: 'Pendente',
      alias: issue.found,
      canonical: issue.canonical,
      occurrences: issue.occurrences,
      action: 'revisar glossary/contexto',
      raw: issue,
    });
  }

  if (!rows.length) {
    return '<tr><td colspan="5" class="small">Nenhuma correção de entidade registrada nesta execução.</td></tr>';
  }

  return rows
    .sort((a, b) => Number(b.occurrences || 0) - Number(a.occurrences || 0))
    .map((row, index) => `
      <tr class="expandable-row" data-status="${row.status}" data-detail="correction-${index}">
        <td>${statusBadge(row.status, row.label)}</td>
        <td><button class="row-toggle" type="button" aria-expanded="false">+</button>${escapeHtml(row.alias)}</td>
        <td>${escapeHtml(row.canonical)}</td>
        <td>${formatNumber(row.occurrences)}</td>
        <td>${escapeHtml(row.action)}</td>
      </tr>
      <tr class="detail-row" data-status="${row.status}" id="correction-${index}">
        <td colspan="5">${renderDetailPanel({
          title: `${row.alias} -> ${row.canonical}`,
          status: row.status,
          evidence: [
            `Ocorrências: ${formatNumber(row.occurrences)}.`,
            `Ação registrada: ${row.action}.`,
          ],
          interpretation: row.status === 'warn'
            ? 'Este item ficou pendente porque precisa de confirmação de glossário ou contexto.'
            : 'Este alias foi substituído durante a normalização antes do fix-gender.',
          actions: row.status === 'warn'
            ? [
              'Confirmar se o alias e o canônico representam o mesmo personagem.',
              'Se for seguro, adicionar a substituição ao glossário e rodar a normalização.',
              'Se houver ambiguidade, revisar as ocorrências no DOCX atual.',
              'Se for falso positivo, registrar exceção para não reaparecer como pendência.',
            ]
            : [
              'Conferir exemplos se quiser validar a qualidade da substituição.',
              'Manter o alias no glossário para próximas execuções.',
            ],
          examples: row.examples,
          raw: row.raw,
        })}</td>
      </tr>`)
    .join('');
}

function getVersionInfo(report) {
  const workflow = report.versionWorkflow || {};
  const trace = report.workflowTrace || {};
  const flow = workflow.flow?.length
    ? [...workflow.flow]
    : [workflow.origin || 'input/translatedGoogle'];
  const currentLabel = workflow.currentVersion ? `v${workflow.currentVersion}` : null;
  const nextLabel = workflow.nextVersion ? `v${workflow.nextVersion}` : 'v1';

  if (currentLabel && !flow.includes(currentLabel)) flow.push(currentLabel);
  if (workflow.workingInput?.includes('current') && !flow.includes('current')) flow.push('current');
  if (nextLabel && !flow.includes(nextLabel)) flow.push(nextLabel);

  return {
    workingInput: workflow.workingInput || 'desconhecida',
    currentVersion: workflow.currentVersion ? `v${workflow.currentVersion}` : 'nenhuma',
    nextVersion: nextLabel,
    flow,
    overwritten: (trace.writes || []).some((event) => event.overwrite),
  };
}

function renderVersionTimeline(report) {
  const version = getVersionInfo(report);
  const fileFlows = report.workflowTrace?.fileFlows || [];

  if (fileFlows.length) {
    return fileFlows.map((flow) => {
      const nodes = [];
      const firstSource = flow.events.find((event) => event.source)?.source;

      if (firstSource) {
        nodes.push({
          title: firstSource,
          subtitle: 'arquivo de origem',
          type: 'path',
        });
      }

      for (const event of flow.events) {
        if (event.event === 'CORRECTION_SOURCE') continue;

        nodes.push({
          title: event.stage,
          subtitle: event.version || `step ${event.step || '?'}`,
          type: 'stage',
        });

        if (event.destination) {
          nodes.push({
            title: event.destination,
            subtitle: event.changed === false ? 'cópia sem alteração' : 'arquivo gerado',
            type: 'path',
          });
        }
      }

      return `
        <div class="file-flow">
          <h3>${escapeHtml(flow.file)}</h3>
          <div class="timeline detailed">
            ${nodes.map((node, index) => `
              ${index > 0 ? '<div class="arrow">-&gt;</div>' : ''}
              <div class="node ${node.type === 'path' ? 'path-node' : 'stage-node'}">
                <strong>${escapeHtml(node.title)}</strong>
                <span>${escapeHtml(node.subtitle)}</span>
              </div>`).join('')}
          </div>
        </div>`;
    }).join('');
  }

  return version.flow.map((node, index) => `
    ${index > 0 ? '<div class="arrow">-&gt;</div>' : ''}
    <div class="node">
      <strong>${escapeHtml(node)}</strong>
      <span>${index === 0 ? 'base inicial' : index === version.flow.length - 1 ? 'próxima esperada' : 'etapa atual'}</span>
    </div>`).join('');
}

function buildDiagnostics(report, previousReport, normalization) {
  const diagnostics = [];
  const workingInput = report.versionWorkflow?.workingInput || '';

  diagnostics.push({
    status: workingInput.includes('input-fixed') ? 'ok' : 'warn',
    title: workingInput.includes('input-fixed')
      ? 'Reauditoria usa working source.'
      : 'Auditoria ainda parece usar a origem inicial.',
    detail: `Alvo registrado: ${workingInput || 'desconhecido'}.`,
    actions: workingInput.includes('input-fixed')
      ? ['Continuar reauditorias usando input-fixed/current.']
      : ['Verificar getWorkingInput e garantir que a reauditoria use input-fixed/current.'],
  });

  const previousAliases = previousReport?.entityConsistency?.totalAliasOccurrences;
  const currentAliases = report.entityConsistency?.totalAliasOccurrences || 0;
  diagnostics.push({
    status: previousAliases === undefined || currentAliases <= previousAliases ? 'ok' : 'warn',
    title: currentAliases > 0 ? 'Normalização reduziu, mas ainda deixou pendências.' : 'Normalização de entidades sem pendências.',
    detail: previousAliases === undefined
      ? `${formatNumber(currentAliases)} ocorrências pendentes agora.`
      : `Antes: ${formatNumber(previousAliases)} · depois: ${formatNumber(currentAliases)}.`,
    actions: currentAliases > 0
      ? ['Abrir Consistência de entidades e tratar cada pendência.', 'Atualizar entityGlossary.json quando a substituição for segura.']
      : ['Manter os aliases conhecidos no glossário.'],
  });

  const overwritten = getVersionInfo(report).overwritten;
  diagnostics.push({
    status: overwritten ? 'warn' : 'ok',
    title: overwritten ? 'Versionamento registrou sobrescrita.' : 'Versionamento sem sobrescrita detectada.',
    detail: `Versão atual: ${getVersionInfo(report).currentVersion} · próxima: ${getVersionInfo(report).nextVersion}.`,
    actions: overwritten
      ? ['Conferir se a sobrescrita foi intencional.', 'Na próxima execução, confirmar se o destino será a próxima versão esperada.']
      : ['Nenhuma ação imediata necessária.'],
  });

  const previousGender = sumIssueOccurrences(previousReport, (issue) => issue.type === 'gender_issue');
  const currentGender = sumIssueOccurrences(report, (issue) => issue.type === 'gender_issue');
  diagnostics.push({
    status: currentGender === 0 ? 'ok' : previousGender && currentGender > previousGender ? 'fail' : 'warn',
    title: currentGender === 0 ? 'Fix-gender não deixou issues críticas.' : 'Fix-gender ainda precisa revisão.',
    detail: previousGender
      ? `Antes: ${formatNumber(previousGender)} · depois: ${formatNumber(currentGender)}.`
      : `${formatNumber(currentGender)} ocorrências críticas de gênero agora.`,
    actions: currentGender > 0
      ? ['Abrir as linhas de gender issue em Comparativo e Issues e warnings.', 'Separar erro real de falso positivo antes de mexer no fix-gender.']
      : ['Nenhuma ação imediata necessária.'],
  });

  if (normalization?.preprocessing?.aliasesReplaced) {
    diagnostics.push({
      status: 'info',
      title: 'Pré-processamento de entidades aplicado.',
      detail: `${formatNumber(normalization.preprocessing.aliasesReplaced)} ocorrências substituídas antes do fix-gender.`,
      actions: ['Usar Correções aplicadas para revisar exemplos antes/depois.', 'Se uma substituição ficou estranha, ajustar o glossário.'],
    });
  }

  return diagnostics;
}

function renderDiagnostics(report, previousReport, normalization) {
  return buildDiagnostics(report, previousReport, normalization).map((item) => `
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
        interpretation: 'Este diagnóstico foi inferido a partir dos contadores e eventos da execução atual.',
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
        interpretation: item.type === 'gender_issue'
          ? 'Esse padrão aponta uma possível discordância de gênero, mas precisa de amostra textual para separar erro real de falso positivo.'
          : item.type === 'ENTITY_ALIAS_FOUND'
            ? 'Uma entidade protegida apareceu com forma alternativa no texto auditado.'
            : 'O auditor encontrou um sinal estrutural que merece triagem.',
        actions: item.type === 'gender_issue'
          ? [
            'Usar os exemplos de contexto abaixo para separar erro real de falso positivo.',
            'Validar se a ocorrência é erro real.',
            'Criar regra de correção somente depois de confirmar o padrão.',
          ]
          : item.type === 'ENTITY_ALIAS_FOUND'
            ? [
              'Abrir Consistência de entidades para decidir a ação.',
              'Atualizar glossário ou revisar manualmente se houver ambiguidade.',
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

export function writeHtmlDashboard(report, htmlPath, {
  logsDir,
  sourceDocs = [],
  translatedDocs = [],
  alignedDocs = [],
} = {}) {
  const previousReport = logsDir ? getLatestJsonReport(logsDir, report.stats?.timestamp) : null;
  const normalization = logsDir ? getLatestNormalization(logsDir) : null;
  const version = getVersionInfo(report);
  const fileLabel = report.files?.map((file) => file.filename).filter(Boolean).join(', ') || 'sem arquivo';
  const rawJson = JSON.stringify({
    status: report.status,
    workingSource: version.workingInput,
    currentVersion: version.currentVersion,
    nextVersion: version.nextVersion,
    stats: report.stats,
    entityConsistency: report.entityConsistency,
    diagnostics: buildDiagnostics(report, previousReport, normalization),
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
    <h1>Audit Dashboard - audit-translation-docx</h1>
    <div class="subtitle">
      Arquivo: <strong>${escapeHtml(fileLabel)}</strong> · Execução: <strong>${escapeHtml(report.stats.timestamp)}</strong>
    </div>
  </header>

  <main>
    <div class="grid grid-4">
      <div class="card">
        <div class="metric-label">Status consolidado</div>
        <div class="metric-value">${statusBadge(report.status)}</div>
        <div class="metric-note">${report.stats.failIssues > 0 ? 'Ainda existem issues críticas.' : 'Sem issues críticas detectadas.'}</div>
      </div>

      <div class="card">
        <div class="metric-label">Working source</div>
        <div class="metric-value" style="font-size:20px">${escapeHtml(version.workingInput)}</div>
        <div class="metric-note">Origem usada nesta auditoria.</div>
      </div>

      <div class="card">
        <div class="metric-label">Versão atual</div>
        <div class="metric-value">${escapeHtml(version.currentVersion)}</div>
        <div class="metric-note">Próxima versão esperada: ${escapeHtml(version.nextVersion)}.</div>
      </div>

      <div class="card">
        <div class="metric-label">Entidades pendentes</div>
        <div class="metric-value">${formatNumber(report.entityConsistency?.totalAliasOccurrences || 0)}</div>
        <div class="metric-note">${formatNumber(report.entityConsistency?.aliasesFound || 0)} tipos de alias.</div>
      </div>
    </div>

    <section>
      <div class="section-title">
        <div>
          <h2>Fluxo de versionamento</h2>
          <p>Cadeia evolutiva esperada da tradução.</p>
        </div>
        ${statusBadge(version.overwritten ? 'WARN' : 'OK', version.overwritten ? 'sobrescrita detectada' : 'sem sobrescrita')}
      </div>

      <div class="card">
        <div class="timeline">${renderVersionTimeline(report)}</div>
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

    <section>
      <div class="section-title">
        <div>
          <h2>Consistência de entidades</h2>
          <p>Visão por personagem canônico.</p>
        </div>
      </div>

      <div class="grid grid-2">${renderEntityCards(report, normalization)}</div>
    </section>

    <section>
      <div class="section-title">
        <div>
          <h2>Correções aplicadas</h2>
          <p>Tabela filtrável para revisão rápida.</p>
        </div>
      </div>

      <div class="card">
        <div class="toolbar">
          <input id="search" placeholder="Filtrar por alias ou personagem..." />
          <select id="severity">
            <option value="">Todos</option>
            <option value="ok">Resolvidos</option>
            <option value="warn">Pendentes</option>
          </select>
        </div>

        <table id="corrections">
          <thead>
            <tr>
              <th>Status</th>
              <th>Alias</th>
              <th>Canônico</th>
              <th>Ocorrências</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>${renderCorrectionsRows(report, normalization)}</tbody>
        </table>
      </div>
    </section>

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
          <p>Conclusões objetivas a partir dos logs.</p>
        </div>
      </div>

      <div class="card diagnostics">${renderDiagnostics(report, previousReport, normalization)}</div>
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
