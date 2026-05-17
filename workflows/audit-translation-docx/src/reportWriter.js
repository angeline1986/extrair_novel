// src/reportWriter.js
// Geração de relatórios: JSON, CSV e resumo em texto

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Formatar timestamp para nomes de arquivo
function formatTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
}

// Gerar relatórios completos
export function generateReports({
  sourceDocs,
  translatedDocs,
  alignedDocs,
  allIssues,
  allWarnings,
  ollamaResults = [],
  config,
}) {
  const timestamp = formatTimestamp();
  const logsDir = config.files.logsDir; // Todos os relatórios vão para logs/
  const outputDir = config.files.outputDir; // Apenas DOCX

  // Estatísticas gerais
  const stats = {
    timestamp,
    sourceFiles: sourceDocs.length,
    translatedFiles: translatedDocs.length,
    matchedFiles: alignedDocs.filter((d) => d.alignment === "matched").length,
    missingFiles: alignedDocs.filter((d) => d.alignment === "missing").length,
    totalIssues: allIssues.length,
    totalWarnings: allWarnings.length,
    failIssues: allIssues.filter((i) => i.severity === "FAIL").length,
    warnIssues: allIssues.filter((i) => i.severity === "WARN").length,
    ollamaReviews: ollamaResults.length,
    ollamaFails: ollamaResults.filter((r) => r.review?.status === "fail")
      .length,
    ollamaWarnings: ollamaResults.filter((r) => r.review?.status === "warning")
      .length,
  };

  // Determinar status consolidado
  let consolidatedStatus = "OK";
  if (stats.failIssues > 0 || stats.ollamaFails > 0) {
    consolidatedStatus = "FAIL";
  } else if (
    stats.warnIssues > 0 ||
    stats.ollamaWarnings > 0 ||
    stats.totalWarnings > 0
  ) {
    consolidatedStatus = "WARN";
  }

  // Construir relatório completo
  const report = {
    status: consolidatedStatus,
    stats,
    summary: generateSummary(
      alignedDocs,
      allIssues,
      allWarnings,
      ollamaResults,
    ),
    issues: allIssues.map(serializeIssue),
    warnings: allWarnings.map(serializeWarning),
    ollamaResults: ollamaResults.map(serializeOllamaResult),
    files: alignedDocs.map((doc) => serializeFile(doc)),
    config: {
      thresholds: config.thresholds,
      ollamaModel: config.ollama.model,
    },
  };

  // Escrever JSON
  //const jsonPath = path.join(outputDir, `audit-report-${timestamp}.json`);
  const jsonPath = path.join(logsDir, `audit-report-${timestamp}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");
  console.log(`📄 JSON: ${jsonPath}`);

  // Escrever CSV de issues
  if (allIssues.length > 0 || allWarnings.length > 0) {
    //const csvPath = path.join(outputDir, `issues-${timestamp}.csv`);
    const csvPath = path.join(logsDir, `issues-${timestamp}.csv`);
    writeIssuesCsv(allIssues, allWarnings, csvPath, config.report.csvDelimiter);
    console.log(`📊 CSV: ${csvPath}`);
  }

  // Escrever resumo em texto
  const summaryPath = path.join(logsDir, `audit-summary-${timestamp}.txt`);
  writeTextSummary(report, summaryPath);
  console.log(`📝 Resumo: ${summaryPath}`);

  // Escrever relatório de capítulos problemáticos (legível para humanos)
  if (stats.failIssues > 0 || stats.ollamaFails > 0) {
const detailsPath = path.join(logsDir, `problematic-chapters-${timestamp}.txt`);
    writeProblematicChaptersReport(alignedDocs, ollamaResults, detailsPath);
    console.log(`⚠️  Detalhes de problemas: ${detailsPath}`);
  }

  return report;
}

// Gerar sumário em texto
function generateSummary(alignedDocs, issues, warnings, ollamaResults) {
  const missingChapters = [];
  const sizeIssues = [];

  for (const doc of alignedDocs) {
    if (doc.chapters) {
      for (const chapter of doc.chapters) {
        if (chapter.matchType === "missing") {
          missingChapters.push({
            file: doc.source?.filename || "unknown",
            index: chapter.sourceIndex,
            title: chapter.sourceTitle,
          });
        }
        if (chapter.matchType === "matched") {
          const ratio =
            chapter.translationCharCount / Math.max(chapter.sourceCharCount, 1);
          if (ratio < 0.5) {
            sizeIssues.push({
              file: doc.source.filename,
              chapter:
                chapter.sourceTitle || `Capítulo ${chapter.sourceIndex + 1}`,
              ratio: ratio.toFixed(2),
            });
          }
        }
      }
    }
  }

  return {
    missingChapters: missingChapters.length,
    sizeIssues: sizeIssues.length,
    totalIssues: issues.length,
    totalWarnings: warnings.length,
    ollamaIssues: ollamaResults.filter((r) => r.review?.status === "fail")
      .length,
    firstMissingChapters: missingChapters.slice(0, 5),
    firstSizeIssues: sizeIssues.slice(0, 5),
  };
}

// Serializar issue para JSON
function serializeIssue(issue) {
  return {
    type: issue.type,
    severity: issue.severity,
    description: issue.description || getIssueDescription(issue),
    details: issue.details || null,
    occurrences: issue.occurrences || null,
  };
}

// Serializar warning para JSON
function serializeWarning(warning) {
  return {
    type: warning.type,
    severity: warning.severity,
    description: warning.description || getWarningDescription(warning),
    details: warning.details || null,
    occurrences: warning.occurrences || null,
  };
}

// Serializar resultado do Ollama
function serializeOllamaResult(result) {
  return {
    type: result.type,
    sourceTitle: result.sourceTitle,
    translationTitle: result.translationTitle,
    confidence: result.confidence,
    review: result.review,
  };
}

// Serializar arquivo para JSON
function serializeFile(doc) {
  if (doc.alignment === "missing") {
    return {
      filename: doc.source.filename,
      alignment: "missing",
      sourceChars: doc.source.charCount,
      sourceParagraphs: doc.source.paragraphCount,
    };
  }

  return {
    filename: doc.source.filename,
    translationFilename: doc.translation.filename,
    alignment: doc.alignment,
    severity: doc.severity,
    sourceChars: doc.source.charCount,
    sourceParagraphs: doc.source.paragraphCount,
    translationChars: doc.translation.charCount,
    translationParagraphs: doc.translation.paragraphCount,
    chapterCount: doc.stats.sourceChapters,
    matchedChapters: doc.stats.matchedChapters,
    chapterIssues: doc.chapters.filter((c) => c.matchType !== "matched").length,
  };
}

// Escrever CSV de issues e warnings
function writeIssuesCsv(issues, warnings, csvPath, delimiter = ";") {
  const lines = [];

  // Cabeçalho
  lines.push(
    ["Severity", "Type", "Description", "Details", "Occurrences"].join(
      delimiter,
    ),
  );

  // Issues (FAIL e WARN)
  for (const issue of issues) {
    lines.push(
      [
        issue.severity,
        issue.type,
        issue.description || getIssueDescription(issue),
        typeof issue.details === "object"
          ? JSON.stringify(issue.details).substring(0, 200)
          : issue.details || "",
        issue.occurrences || "",
      ].join(delimiter),
    );
  }

  // Warnings separados
  for (const warning of warnings) {
    lines.push(
      [
        "WARN",
        warning.type,
        warning.description || getWarningDescription(warning),
        typeof warning.details === "object"
          ? JSON.stringify(warning.details).substring(0, 200)
          : warning.details || "",
        warning.occurrences || "",
      ].join(delimiter),
    );
  }

  fs.writeFileSync(csvPath, lines.join("\n"), "utf8");
}

// Escrever resumo em texto legível
function writeTextSummary(report, summaryPath) {
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
    "-".repeat(40),
    "RESUMO DOS PROBLEMAS",
    "-".repeat(40),
    `Capítulos faltando: ${report.summary.missingChapters}`,
    `Capítulos com tamanho muito reduzido: ${report.summary.sizeIssues}`,
    "",
  ];

  // Adicionar primeiros capítulos faltando
  if (report.summary.firstMissingChapters.length > 0) {
    lines.push("Primeiros capítulos faltando:");
    for (const missing of report.summary.firstMissingChapters) {
      lines.push(
        `  - ${missing.file}: ${missing.title || `Capítulo ${missing.index + 1}`}`,
      );
    }
    lines.push("");
  }

  // Adicionar issues principais
  const failIssues = report.issues.filter((i) => i.severity === "FAIL");
  if (failIssues.length > 0) {
    lines.push("-".repeat(40));
    lines.push("ISSUES CRÍTICAS (FAIL)");
    lines.push("-".repeat(40));
    for (const issue of failIssues.slice(0, 10)) {
      lines.push(`[${issue.type}] ${issue.description}`);
      if (issue.details) {
        lines.push(
          `  Detalhe: ${JSON.stringify(issue.details).substring(0, 150)}`,
        );
      }
      lines.push("");
    }
    if (failIssues.length > 10) {
      lines.push(`... e mais ${failIssues.length - 10} issues críticas`);
    }
    lines.push("");
  }

  // Adicionar resultados do Ollama
  const ollamaFails = report.ollamaResults.filter(
    (r) => r.review?.status === "fail",
  );
  if (ollamaFails.length > 0) {
    lines.push("-".repeat(40));
    lines.push("PROBLEMAS DETECTADOS POR IA (OLLAMA)");
    lines.push("-".repeat(40));
    for (const result of ollamaFails.slice(0, 5)) {
      lines.push(`Capítulo: ${result.sourceTitle || "Sem título"}`);
      lines.push(
        `  Problema: ${result.review.problem || "Perda de sentido detectada"}`,
      );
      lines.push(
        `  Sugestão: ${result.review.suggestion || "Revisar manualmente"}`,
      );
      lines.push("");
    }
  }

  lines.push("=".repeat(80));
  lines.push(
    `Relatório completo: ${report.files?.[0]?.filename ? "../output/audit-report.json" : "verificar output"}`,
  );
  lines.push("=".repeat(80));

  fs.writeFileSync(summaryPath, lines.join("\n"), "utf8");
}

// Escrever relatório detalhado de capítulos problemáticos
function writeProblematicChaptersReport(
  alignedDocs,
  ollamaResults,
  detailsPath,
) {
  const lines = [
    "=".repeat(80),
    "RELATÓRIO DE CAPÍTULOS PROBLEMÁTICOS",
    "=".repeat(80),
    "",
    "Este relatório lista capítulos que requerem atenção especial.",
    "",
  ];

  // Mapa de resultados Ollama por título
  const ollamaMap = new Map();
  for (const result of ollamaResults) {
    const key = `${result.sourceTitle || ""}|${result.translationTitle || ""}`;
    ollamaMap.set(key, result);
  }

  for (const doc of alignedDocs) {
    if (doc.alignment !== "matched" || !doc.chapters) continue;

    const problemChapters = doc.chapters.filter((ch) => {
      if (ch.matchType !== "matched") return true;
      // Verificar se tem resultado Ollama com problema
      const key = `${ch.sourceTitle || ""}|${ch.translationTitle || ""}`;
      const ollama = ollamaMap.get(key);
      return ollama?.review?.status === "fail" || ch.confidence < 0.5;
    });

    if (problemChapters.length === 0) continue;

    lines.push("");
    lines.push(`📁 ARQUIVO: ${doc.source.filename}`);
    lines.push(`   Tradução: ${doc.translation.filename}`);
    lines.push(
      `   Capítulos problemáticos: ${problemChapters.length}/${doc.chapters.length}`,
    );
    lines.push("");

    for (const chapter of problemChapters) {
      lines.push(
        `   🔸 ${chapter.sourceTitle || `Capítulo ${chapter.sourceIndex + 1}`}`,
      );

      if (chapter.matchType === "missing") {
        lines.push(`      ❌ CAPÍTULO AUSENTE NA TRADUÇÃO`);
        lines.push(
          `      - Parágrafos no original: ${chapter.sourceParagraphs}`,
        );
        lines.push(
          `      - Caracteres no original: ${chapter.sourceCharCount}`,
        );
      } else if (chapter.matchType === "extra") {
        lines.push(`      ⚠️ CAPÍTULO EXTRA NA TRADUÇÃO`);
        lines.push(
          `      - Título: ${chapter.translationTitle || "Sem título"}`,
        );
        lines.push(`      - Parágrafos: ${chapter.translationParagraphs}`);
      } else {
        const sizeRatio =
          chapter.translationCharCount / Math.max(chapter.sourceCharCount, 1);
        const key = `${chapter.sourceTitle || ""}|${chapter.translationTitle || ""}`;
        const ollama = ollamaMap.get(key);

        if (sizeRatio < 0.5) {
          lines.push(
            `      ⚠️ TAMANHO REDUZIDO (${(sizeRatio * 100).toFixed(0)}% do original)`,
          );
        }

        if (ollama?.review?.status === "fail") {
          lines.push(`      🤖 IA detectou perda de sentido:`);
          lines.push(
            `         - Problema: ${ollama.review.problem || "Não especificado"}`,
          );
          if (ollama.review.suggestion) {
            lines.push(`         - Sugestão: ${ollama.review.suggestion}`);
          }
        } else if (chapter.confidence < 0.5) {
          lines.push(
            `      ⚠️ Baixa confiança no alinhamento (${(chapter.confidence * 100).toFixed(0)}%)`,
          );
        }
      }
      lines.push("");
    }

    lines.push("-".repeat(60));
  }

  lines.push("");
  lines.push("=".repeat(80));
  lines.push("FIM DO RELATÓRIO");
  lines.push("=".repeat(80));

  fs.writeFileSync(detailsPath, lines.join("\n"), "utf8");
}

// Descrições legíveis para issues
function getIssueDescription(issue) {
  const descriptions = {
    missing_chapters:
      "Capítulos presentes no original estão ausentes na tradução",
    size_ratio_too_low:
      "Tradução com menos de 40% do tamanho do original (perda significativa de conteúdo)",
    empty_translation:
      "Tradução praticamente vazia para um original com conteúdo substancial",
    gender_issue:
      "Problemas de gênero gramatical (comum em traduções automáticas)",
    english_words_retained: "Palavras em inglês mantidas na tradução",
    name_corruption: "Nomes próprios foram alterados ou corrompidos",
    missing_translation_file:
      "Arquivo de tradução não encontrado para este original",
  };

  return descriptions[issue.type] || issue.type;
}

function getWarningDescription(warning) {
  const descriptions = {
    size_ratio_low:
      "Tradução significativamente menor que o original (possível perda de conteúdo)",
    paragraph_count_low: "Número de parágrafos muito menor que o original",
    extra_chapters:
      "Capítulos extras presentes na tradução que não existem no original",
    broken_sentence: "Frases quebradas ou pontuação incorreta",
    weird_spacing: "Espaçamento estranho antes de pontuação",
    auto_translate_mark: "Marca de tradução automática detectada",
    low_confidence_chapter: "Alinhamento do capítulo com baixa confiança",
  };

  return descriptions[warning.type] || warning.type;
}
