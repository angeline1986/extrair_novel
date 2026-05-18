// src/reportWriter/textWriter.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');

function writeParagraphPreview(sourceDocs, translatedDocs) {
  const lines = [];
  
  lines.push('');
  lines.push('-'.repeat(40));
  lines.push('PRIMEIROS PARÁGRAFOS DOS ARQUIVOS');
  lines.push('-'.repeat(40));
  
  for (const doc of sourceDocs) {
    lines.push(`\n📄 ORIGINAL: ${doc.filename}`);
    lines.push(`   Primeiros parágrafos:`);
    for (let i = 0; i < Math.min(3, doc.paragraphs.length); i++) {
      const preview = doc.paragraphs[i].substring(0, 150);
      const suffix = doc.paragraphs[i].length > 150 ? '...' : '"';
      lines.push(`   ${i + 1}. "${preview}${suffix}`);
    }
  }
  
  for (const doc of translatedDocs) {
    lines.push(`\n📄 TRADUÇÃO: ${doc.filename}`);
    lines.push(`   Primeiros parágrafos:`);
    for (let i = 0; i < Math.min(3, doc.paragraphs.length); i++) {
      const preview = doc.paragraphs[i].substring(0, 150);
      const suffix = doc.paragraphs[i].length > 150 ? '...' : '"';
      lines.push(`   ${i + 1}. "${preview}${suffix}`);
    }
  }
  
  lines.push('');
  return lines;
}

function readWorkflowEvents(workflowEventsFile) {
  if (!fs.existsSync(workflowEventsFile)) return [];

  return fs.readFileSync(workflowEventsFile, 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function getCurrentRunEvents(events) {
  const lastRunIndex = events.map((event) => event.event).lastIndexOf('WORKFLOW_STARTED');

  if (lastRunIndex < 0) return events;

  return events.slice(lastRunIndex);
}

function getVersionFromDestination(destination = '') {
  const normalized = destination.replaceAll('\\', '/');
  const match = normalized.match(/\/input-fixed\/v(\d+)\//);

  return match ? `v${match[1]}` : null;
}

function buildVersionHistoryLines() {
  const workflowEventsFile = path.join(projectRoot, 'logs', 'workflow-events.jsonl');
  const events = readWorkflowEvents(workflowEventsFile);

  if (!events.length) return [];

  const runEvents = getCurrentRunEvents(events);
  const lastRun = runEvents.find((event) => event.event === 'WORKFLOW_STARTED');
  const rawVersionWriteEvents = runEvents
    .filter((event) => event.event === 'FILE_WRITE')
    .map((event) => ({
      ...event,
      version: getVersionFromDestination(event.destination),
    }))
    .filter((event) => event.version);
  const versionWriteEventsByDestination = new Map();

  for (const event of rawVersionWriteEvents) {
    const existing = versionWriteEventsByDestination.get(event.destination);

    if (!existing || (event.source && !existing.source) || event.overwrite) {
      versionWriteEventsByDestination.set(event.destination, event);
    }
  }

  const versionWriteEvents = [...versionWriteEventsByDestination.values()];
  const versionDecisionEvents = runEvents.filter((event) => event.event === 'VERSION_DECISION');

  if (!versionWriteEvents.length && !lastRun && !versionDecisionEvents.length) return [];

  const lines = [
    '',
    '='.repeat(80),
    'HISTÓRICO / VERSIONAMENTO',
    '='.repeat(80),
    '',
  ];

  if (lastRun) {
    lines.push(`Step atual: ${lastRun.currentStep || '?'}`);
    lines.push(`Modo: ${lastRun.mode || 'normal'}`);
    lines.push('');
  }

  const versionsFound = [];
  for (let i = 1; i <= 10; i++) {
    const vPath = path.join(projectRoot, 'input-fixed', `v${i}`);
    if (fs.existsSync(vPath)) versionsFound.push(`v${i}`);
  }

  const versionsWritten = new Map();
  const overwrittenVersions = new Set();

  for (const event of versionWriteEvents) {
    if (!versionsWritten.has(event.version)) {
      versionsWritten.set(event.version, []);
    }

    versionsWritten.get(event.version).push({
      file: event.file || path.basename(event.destination),
      action: event.action || 'write',
      overwrite: Boolean(event.overwrite),
      source: event.source || '',
      destination: event.destination,
    });

    if (event.overwrite) {
      overwrittenVersions.add(event.version);
    }
  }

  const versionsCreated = [...versionsWritten.keys()].sort((a, b) =>
    Number(a.slice(1)) - Number(b.slice(1))
  );
  const overwritten = [...overwrittenVersions].sort((a, b) =>
    Number(a.slice(1)) - Number(b.slice(1))
  );

  lines.push(`Versões encontradas: ${versionsFound.length > 0 ? versionsFound.join(', ') : 'nenhuma'}`);
  lines.push(`Versões criadas nesta execução: ${versionsCreated.length > 0 ? versionsCreated.join(', ') : 'nenhuma'}`);
  lines.push(`Versões sobrescritas nesta execução: ${overwritten.length > 0 ? overwritten.join(', ') : 'nenhuma'}`);

  if (versionDecisionEvents.length > 0) {
    lines.push('');
    lines.push('Decisões de versão:');
    for (const event of versionDecisionEvents) {
      const targetVersion = event.details?.targetVersion || `v${event.step}`;
      const reason = event.details?.reason || 'sem motivo registrado';
      lines.push(`  - ${event.file || 'arquivo desconhecido'} -> ${targetVersion} (${reason})`);
    }
  }

  if (versionWriteEvents.length > 0) {
    lines.push('');
    lines.push('Arquivos versionados nesta execução:');
    for (const event of versionWriteEvents) {
      const status = event.overwrite ? 'sobrescrito' : 'criado';
      lines.push(`  - ${event.version}: ${event.file || path.basename(event.destination)} (${status})`);
      if (event.source) lines.push(`    Origem: ${event.source}`);
      lines.push(`    Destino: ${event.destination}`);
    }
  }

  const gapEvents = runEvents.filter((event) => event.event === 'VERSION_MISSING_GAP');
  if (gapEvents.length > 0) {
    lines.push('');
    lines.push('⚠️ GAP DETECTADO:');
    for (const gap of gapEvents) {
      lines.push(`   ${gap.details?.explanation || 'versões ausentes detectadas'}`);
      if (gap.details?.missingVersions) {
        lines.push(`   Versões ausentes: ${gap.details.missingVersions.join(', ')}`);
      }
    }
  }

  lines.push('');
  return lines;
}

function buildEntityConsistencyLines(entityConsistency) {
  if (!entityConsistency) return [];

  const lines = [
    '-'.repeat(40),
    'CONSISTÊNCIA DE ENTIDADES',
    '-'.repeat(40),
    `Status: ${entityConsistency.status}`,
    `Aliases detectados: ${entityConsistency.aliasesFound || 0}`,
    `Ocorrências de aliases: ${entityConsistency.totalAliasOccurrences || 0}`,
    '',
  ];

  if (!entityConsistency.issues?.length) {
    lines.push('Nenhum alias suspeito encontrado para entidades protegidas.');
    lines.push('');
    return lines;
  }

  const grouped = new Map();

  for (const issue of entityConsistency.issues) {
    if (!grouped.has(issue.canonical)) {
      grouped.set(issue.canonical, []);
    }
    grouped.get(issue.canonical).push(issue);
  }

  lines.push('Aliases detectados:');
  for (const [canonical, issues] of grouped) {
    const aliases = issues.map((issue) => issue.found).join(', ');
    const occurrences = issues.reduce((sum, issue) => sum + issue.occurrences, 0);
    lines.push(`- ${canonical} apareceu como: ${aliases}`);
    lines.push(`  Ocorrências: ${occurrences}`);
  }

  lines.push('');
  lines.push('Sugestão:');
  lines.push('Rodar normalização de entidades antes da próxima auditoria.');
  lines.push('');

  return lines;
}

function buildWorkingSourceLines(versionWorkflow) {
  if (!versionWorkflow) return [];

  const flow = versionWorkflow.flow?.length
    ? versionWorkflow.flow.join(' → ')
    : 'translatedGoogle';

  return [
    'WORKING SOURCE',
    '--------------',
    'Origem auditada:',
    `- ${versionWorkflow.workingInput || 'desconhecida'}`,
    '',
    'Versão atual:',
    `- ${versionWorkflow.currentVersion ? `v${versionWorkflow.currentVersion}` : 'nenhuma'}`,
    '',
    'Próxima versão:',
    `- v${versionWorkflow.nextVersion || 1}`,
    '',
    'Origem inicial:',
    `- ${versionWorkflow.origin || 'input/translatedGoogle'}`,
    '',
    'Fluxo:',
    flow,
    '',
  ];
}

export function writeTextSummary(report, summaryPath, sourceDocs, translatedDocs) {
  const lines = [
    "=".repeat(80),
    "RELATÓRIO DE AUDITORIA DE TRADUÇÕES",
    "=".repeat(80),
    "",
    `Data: ${report.stats.timestamp}`,
    `Status Consolidado: ${report.status}`,
    "",
    "-".repeat(40),
    "ESTATÍSTICAS GERAIS",
    "-".repeat(40),
    `Arquivos originais: ${report.stats.sourceFiles}`,
    `Arquivos traduzidos: ${report.stats.translatedFiles}`,
    `Arquivos pareados: ${report.stats.matchedFiles}`,
    `Arquivos sem correspondência: ${report.stats.missingFiles}`,
    "",
    `Issues (FAIL): ${report.stats.failIssues}`,
    `Issues (WARN): ${report.stats.warnIssues}`,
    `Warnings estruturais: ${report.stats.totalWarnings}`,
    "",
    `Revisões Ollama: ${report.stats.ollamaReviews}`,
    `  - FAIL: ${report.stats.ollamaFails}`,
    `  - WARN: ${report.stats.ollamaWarnings}`,
    "",
  ];

  lines.push(...buildWorkingSourceLines(report.versionWorkflow));
  lines.push(...buildVersionHistoryLines());

  const previewLines = writeParagraphPreview(sourceDocs, translatedDocs);
  lines.push(...previewLines);

  lines.push(...buildEntityConsistencyLines(report.entityConsistency));

  lines.push(
    "-".repeat(40),
    "RESUMO DOS PROBLEMAS",
    "-".repeat(40),
    `Capítulos faltando: ${report.summary.missingChapters}`,
    `Capítulos com tamanho muito reduzido: ${report.summary.sizeIssues}`,
    "",
  );

  if (report.summary.firstMissingChapters.length > 0) {
    lines.push("Primeiros capítulos faltando:");
    for (const missing of report.summary.firstMissingChapters) {
      lines.push(`  - ${missing.file}: ${missing.title || `Capítulo ${missing.index + 1}`}`);
    }
    lines.push("");
  }

  const failIssues = report.issues.filter((i) => i.severity === "FAIL");
  if (failIssues.length > 0) {
    lines.push("-".repeat(40));
    lines.push("ISSUES CRÍTICAS (FAIL)");
    lines.push("-".repeat(40));
    for (const issue of failIssues.slice(0, 10)) {
      lines.push(`[${issue.type}] ${issue.description}`);
      if (issue.details) lines.push(`  Detalhe: ${JSON.stringify(issue.details).substring(0, 150)}`);
      lines.push("");
    }
    if (failIssues.length > 10) lines.push(`... e mais ${failIssues.length - 10} issues críticas`);
    lines.push("");
  }

  const ollamaFails = report.ollamaResults.filter((r) => r.review?.status === "fail");
  if (ollamaFails.length > 0) {
    lines.push("-".repeat(40));
    lines.push("PROBLEMAS DETECTADOS POR IA (OLLAMA)");
    lines.push("-".repeat(40));
    for (const result of ollamaFails.slice(0, 5)) {
      lines.push(`Capítulo: ${result.sourceTitle || "Sem título"}`);
      lines.push(`  Problema: ${result.review.problem || "Perda de sentido detectada"}`);
      lines.push(`  Sugestão: ${result.review.suggestion || "Revisar manualmente"}`);
      lines.push("");
    }
  }

  lines.push("=".repeat(80));
  lines.push(`Relatório completo: ${report.files?.[0]?.filename ? "../logs/audit-report.json" : "verificar pasta logs"}`);
  lines.push("=".repeat(80));

  fs.writeFileSync(summaryPath, lines.join("\n"), "utf8");
}
