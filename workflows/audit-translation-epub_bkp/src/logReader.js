import fs from 'fs';
import path from 'path';

function parseListValue(value) {
  return String(value || '')
    .split(/[,;|]/)
    .map((item) => item.trim())
    .filter((item) => item && item.length <= 80);
}

function escapedRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function termBoundaryRegex(value) {
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escapedRegex(value)}([^\\p{L}\\p{N}]|$)`, 'iu');
}

function isConciseInstruction(text, maxLength = 240) {
  return String(text || '').trim().length <= maxLength;
}

function isReplacementInstruction(line, replacement) {
  if (!isConciseInstruction(line)) return false;
  if (!replacement) return false;

  const from = replacement[1].trim();
  const to = replacement[2].trim();
  if (!from || !to) return false;
  if (from.length > 80 || to.length > 80) return false;

  return true;
}

export function readTranslationLog(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return {
      filePath: filePath || null,
      exists: false,
      rawText: '',
      terms: [],
      notes: [],
      warnings: [],
      replacements: [],
    };
  }

  const rawText = fs.readFileSync(filePath, 'utf8');
  const terms = [];
  const notes = [];
  const warnings = [];
  const replacements = [];
  let readingInstructionBlock = true;

  for (const line of rawText.split(/\r?\n/)) {
    const clean = line.trim();
    if (!clean) {
      if (terms.length || warnings.length || replacements.length) {
        readingInstructionBlock = false;
      }
      continue;
    }

    const keyValue = clean.match(/^([A-Za-zÀ-ÿ _-]+)\s*[:=]\s*(.+)$/);
    if (readingInstructionBlock && keyValue) {
      const key = keyValue[1].trim().toLowerCase();
      const value = keyValue[2].trim();

      if (/^(termos?|glossario|glossário|names?|nomes?|personagens?)$/.test(key) && isConciseInstruction(clean, 500)) {
        terms.push(...parseListValue(value));
        continue;
      }

      if (
        /^(problema|erro|falha|pendencia|pendência|observacao|observação|nota)$/.test(key) ||
        (/^(log aviso|log warning|aviso da traducao|aviso da tradução|warning da traducao|warning da tradução)$/.test(key) && isConciseInstruction(clean))
      ) {
        warnings.push(value);
        continue;
      }
    }

    const replacement = clean.match(/(.+?)\s*(?:->|=>|→)\s*(.+)/);
    if (readingInstructionBlock && isReplacementInstruction(clean, replacement)) {
      replacements.push({
        from: replacement[1].trim(),
        to: replacement[2].trim(),
      });
      continue;
    }

    if (notes.length < 500) notes.push(clean);
  }

  return {
    filePath,
    exists: true,
    filename: path.basename(filePath),
    rawText,
    terms: [...new Set(terms)],
    notes,
    warnings,
    replacements,
  };
}

export function readFirstTxtFromDir(dirPath) {
  if (!fs.existsSync(dirPath)) return null;

  const file = fs.readdirSync(dirPath)
    .filter((name) => name.toLowerCase().endsWith('.txt'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))[0];

  return file ? path.join(dirPath, file) : null;
}

export function auditLogAgainstTranslation(logInfo, sourceDoc, translationDoc) {
  const issues = [];
  const warnings = [];

  if (!logInfo.exists) {
    warnings.push({
      type: 'translation_log_missing',
      severity: 'WARN',
      description: 'Nenhum log TXT de traducao foi encontrado para usar como insumo.',
    });
    return { issues, warnings };
  }

  const sourceText = sourceDoc.rawText || '';
  const translationText = translationDoc.rawText || '';

  for (const term of logInfo.terms) {
    if (term.length < 2) continue;
    const termRegex = termBoundaryRegex(term);
    const replacement = logInfo.replacements.find((item) => item.from.toLowerCase() === term.toLowerCase());
    const replacementTargetRegex = replacement ? termBoundaryRegex(replacement.to) : null;

    if (
      sourceText.match(termRegex) &&
      !translationText.match(termRegex) &&
      !(replacementTargetRegex && translationText.match(replacementTargetRegex))
    ) {
      warnings.push({
        type: 'log_term_not_found_in_translation',
        severity: 'WARN',
        description: `Termo do log nao apareceu na traducao: ${term}`,
        details: { term },
      });
    }
  }

  for (const replacement of logInfo.replacements) {
    const fromRegex = termBoundaryRegex(replacement.from);
    const toRegex = termBoundaryRegex(replacement.to);

    if (translationText.match(fromRegex)) {
      warnings.push({
        type: 'log_replacement_source_still_present',
        severity: 'WARN',
        description: `O log indica trocar "${replacement.from}" por "${replacement.to}", mas a forma antiga ainda aparece.`,
        details: replacement,
      });
    }

    if (!translationText.match(toRegex)) {
      warnings.push({
        type: 'log_replacement_target_missing',
        severity: 'INFO',
        description: `Forma recomendada no log nao encontrada na traducao: ${replacement.to}`,
        details: replacement,
      });
    }
  }

  for (const warning of logInfo.warnings) {
    warnings.push({
      type: 'translation_log_warning',
      severity: 'INFO',
      description: warning,
    });
  }

  return { issues, warnings };
}
