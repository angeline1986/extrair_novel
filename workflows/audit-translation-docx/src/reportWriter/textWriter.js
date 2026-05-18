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

  const workflowEventsFile = path.join(projectRoot, 'logs', 'workflow-events.jsonl');
  if (fs.existsSync(workflowEventsFile)) {
    const events = fs.readFileSync(workflowEventsFile, 'utf8')
      .split('\n')
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l));

    const versionEvents = events.filter((e) => e.event === 'VERSION_CREATED' || e.event === 'VERSION_MISSING_GAP');
    const lastRun = events.filter((e) => e.event === 'WORKFLOW_STARTED').slice(-1)[0];

    if (versionEvents.length > 0 || lastRun) {
      lines.push('');
      lines.push('='.repeat(80));
      lines.push('HISTÓRICO / VERSIONAMENTO');
      lines.push('='.repeat(80));
      lines.push('');

      if (lastRun) {
        lines.push(`Step atual: ${lastRun.currentStep || '?'}`);
        lines.push(`Modo: ${lastRun.mode || 'normal'}`);
        lines.push('');
      }

      const versionsFound = [];
      for (let i = 1; i <= 10; i++) {
        const vPath = path.join(projectRoot, 'workflows/audit-translation-docx/input-fixed', `v${i}`);
        if (fs.existsSync(vPath)) versionsFound.push(`v${i}`);
      }

      const versionsCreated = versionEvents.filter((e) => e.event === 'VERSION_CREATED').map((e) => `v${e.step}`);
      const missingGaps = versionEvents.filter((e) => e.event === 'VERSION_MISSING_GAP');

      lines.push(`Versões encontradas: ${versionsFound.length > 0 ? versionsFound.join(', ') : 'nenhuma'}`);
      lines.push(`Versões criadas nesta execução: ${versionsCreated.length > 0 ? versionsCreated.join(', ') : 'nenhuma'}`);

      if (missingGaps.length > 0) {
        lines.push('');
        lines.push('⚠️ GAP DETECTADO:');
        for (const gap of missingGaps) {
          lines.push(`   ${gap.details?.explanation || 'versões ausentes detectadas'}`);
          if (gap.details?.missingVersions) {
            lines.push(`   Versões ausentes: ${gap.details.missingVersions.join(', ')}`);
          }
        }
      }

      lines.push('');
    }
  }

  const previewLines = writeParagraphPreview(sourceDocs, translatedDocs);
  lines.push(...previewLines);

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