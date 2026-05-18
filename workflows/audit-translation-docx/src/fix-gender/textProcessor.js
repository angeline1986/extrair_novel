// src/fix-gender/textProcessor.js
// Aplicação das correções no texto

import { corrections, additionalFixes } from './corrections.js';

export function applyCorrections(text, verbose = false, correctionsLog = []) {
  let corrected = text;
  let totalChanges = 0;

  for (const correction of corrections) {
    let count = 0;
    const newText = corrected.replace(correction.pattern, (match, ...args) => {
      count++;
      const word = args[0];
      const replacement = typeof correction.replace === 'function' 
        ? correction.replace(match, word) 
        : correction.replace;
      
      if (correctionsLog && correctionsLog.length < 10000) {
        correctionsLog.push({
          before: match.substring(0, 200),
          after: replacement.substring(0, 200),
          type: correction.description,
          pattern: correction.pattern.toString()
        });
      }
      
      return replacement;
    });
    
    if (count > 0) {
      corrected = newText;
      totalChanges += count;
      if (verbose) {
        console.log(`  ✓ ${correction.description}: ${count} ocorrência(s)`);
      }
    }
  }

  for (const fix of additionalFixes) {
    let count = 0;
    const newText = corrected.replace(fix.pattern, (match) => {
      count++;
      const replacement = typeof fix.replace === 'function' ? fix.replace(match) : fix.replace;
      if (correctionsLog && correctionsLog.length < 10000 && count <= 5) {
        correctionsLog.push({
          before: match.substring(0, 200),
          after: replacement.substring(0, 200),
          type: fix.description,
          pattern: fix.pattern.toString()
        });
      }
      return replacement;
    });
    if (count > 0) {
      corrected = newText;
      totalChanges += count;
      if (verbose && count > 0) {
        console.log(`  ✓ ${fix.description}: ${count} ocorrência(s)`);
      }
    }
  }
  
  return { corrected, totalChanges };
}