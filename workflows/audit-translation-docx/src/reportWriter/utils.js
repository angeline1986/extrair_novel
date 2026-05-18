// src/reportWriter/utils.js
// Utilitários comuns

// Formatar timestamp para nomes de arquivo
export function formatTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
}

// Descrições legíveis para issues
export function getIssueDescription(issue) {
  const descriptions = {
    missing_chapters: "Capítulos presentes no original estão ausentes na tradução",
    size_ratio_too_low: "Tradução com menos de 40% do tamanho do original (perda significativa de conteúdo)",
    empty_translation: "Tradução praticamente vazia para um original com conteúdo substancial",
    gender_issue: "Problemas de gênero gramatical (comum em traduções automáticas)",
    english_words_retained: "Palavras em inglês mantidas na tradução",
    name_corruption: "Nomes próprios foram alterados ou corrompidos",
    missing_translation_file: "Arquivo de tradução não encontrado para este original",
  };
  return descriptions[issue.type] || issue.type;
}

export function getWarningDescription(warning) {
  const descriptions = {
    size_ratio_low: "Tradução significativamente menor que o original (possível perda de conteúdo)",
    paragraph_count_low: "Número de parágrafos muito menor que o original",
    extra_chapters: "Capítulos extras presentes na tradução que não existem no original",
    broken_sentence: "Frases quebradas ou pontuação incorreta",
    weird_spacing: "Espaçamento estranho antes de pontuação",
    auto_translate_mark: "Marca de tradução automática detectada",
    low_confidence_chapter: "Alinhamento do capítulo com baixa confiança",
  };
  return descriptions[warning.type] || warning.type;
}

// Determinar status consolidado
export function determineConsolidatedStatus(stats) {
  if (stats.failIssues > 0 || stats.ollamaFails > 0) return "FAIL";
  if (stats.warnIssues > 0 || stats.ollamaWarnings > 0 || stats.totalWarnings > 0) return "WARN";
  return "OK";
}