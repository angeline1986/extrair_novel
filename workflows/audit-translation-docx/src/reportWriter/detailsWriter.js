// src/reportWriter/detailsWriter.js
// Relatório detalhado de capítulos problemáticos

import fs from 'fs';

export function writeProblematicChaptersReport(alignedDocs, ollamaResults, detailsPath) {
  // Mapear resultados do Ollama por título
  const ollamaMap = new Map();
  for (const result of ollamaResults) {
    const key = `${result.sourceTitle || ""}|${result.translationTitle || ""}`;
    ollamaMap.set(key, result);
  }

  // Coletar todos os capítulos problemáticos
  const allProblemChapters = [];
  
  for (const doc of alignedDocs) {
    if (doc.alignment !== "matched" || !doc.chapters) continue;

    const problemChapters = doc.chapters.filter((ch) => {
      if (ch.matchType !== "matched") return true;
      const key = `${ch.sourceTitle || ""}|${ch.translationTitle || ""}`;
      const ollama = ollamaMap.get(key);
      return ollama?.review?.status === "fail" || ch.confidence < 0.5;
    });

    if (problemChapters.length === 0) continue;

    allProblemChapters.push({
      doc,
      problemChapters
    });
  }

  // Se não há capítulos problemáticos, não criar relatório
  if (allProblemChapters.length === 0) {
    return;
  }

  const lines = [
    "=".repeat(80),
    "RELATÓRIO DE CAPÍTULOS PROBLEMÁTICOS",
    "=".repeat(80),
    "",
    "Este relatório lista capítulos que requerem atenção especial.",
    "",
  ];

  for (const { doc, problemChapters } of allProblemChapters) {
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
        if (chapter.sourceParagraphs && chapter.sourceParagraphs.length > 0) {
          const preview = chapter.sourceParagraphs[0]?.substring(0, 150) || "";
          lines.push(`      - Primeiro parágrafo: "${preview}..."`);
        }
      } 
      else if (chapter.matchType === "extra") {
        lines.push(`      ⚠️ CAPÍTULO EXTRA NA TRADUÇÃO`);
        lines.push(
          `      - Título: ${chapter.translationTitle || "Sem título"}`,
        );
        lines.push(`      - Parágrafos: ${chapter.translationParagraphs}`);
        lines.push(`      - Caracteres: ${chapter.translationCharCount}`);
        if (chapter.translationParagraphs > 0) {
          const preview = chapter.translationParagraphs[0]?.substring(0, 150) || "";
          lines.push(`      - Primeiro parágrafo: "${preview}..."`);
        }
      } 
      else {
        const sizeRatio =
          chapter.translationCharCount / Math.max(chapter.sourceCharCount, 1);
        const key = `${chapter.sourceTitle || ""}|${chapter.translationTitle || ""}`;
        const ollama = ollamaMap.get(key);

        if (sizeRatio < 0.5) {
          lines.push(
            `      ⚠️ TAMANHO REDUZIDO (${(sizeRatio * 100).toFixed(0)}% do original)`,
          );
          lines.push(
            `      - Original: ${chapter.sourceCharCount} caracteres`,
          );
          lines.push(
            `      - Tradução: ${chapter.translationCharCount} caracteres`,
          );
        }

        if (sizeRatio > 1.5) {
          lines.push(
            `      ⚠️ TAMANHO AUMENTADO (${(sizeRatio * 100).toFixed(0)}% do original)`,
          );
          lines.push(
            `      - Original: ${chapter.sourceCharCount} caracteres`,
          );
          lines.push(
            `      - Tradução: ${chapter.translationCharCount} caracteres`,
          );
        }

        const paraRatio =
          chapter.translationParagraphs / Math.max(chapter.sourceParagraphs, 1);
        if (paraRatio < 0.5) {
          lines.push(
            `      ⚠️ POUCOS PARÁGRAFOS (${(paraRatio * 100).toFixed(0)}% do original)`,
          );
          lines.push(
            `      - Original: ${chapter.sourceParagraphs} parágrafos`,
          );
          lines.push(
            `      - Tradução: ${chapter.translationParagraphs} parágrafos`,
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
          if (ollama.confidence) {
            lines.push(`         - Confiança: ${(ollama.confidence * 100).toFixed(0)}%`);
          }
        } 
        else if (ollama?.review?.status === "warning") {
          lines.push(`      🤖 IA detectou possíveis problemas:`);
          lines.push(
            `         - Alerta: ${ollama.review.problem || "Não especificado"}`,
          );
        }
        else if (chapter.confidence < 0.5) {
          lines.push(
            `      ⚠️ BAIXA CONFIANÇA NO ALINHAMENTO (${(chapter.confidence * 100).toFixed(0)}%)`,
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