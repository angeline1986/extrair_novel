// src/fix-gender/reportGenerator.js
// Geração do CSV de correções

import fs from 'fs';
import path from 'path';

export function generateCorrectionsCsv(correctionsLog, logsDir, timestamp) {
  if (correctionsLog.length === 0) return;
  
  const csvPath = path.join(logsDir, `correcoes_${timestamp}.csv`);
  const csvHeader = 'Antes,Depois,Tipo,Padrao\n';
  const csvRows = correctionsLog.map(log => 
    `"${log.before.replace(/"/g, '""')}","${log.after.replace(/"/g, '""')}","${log.type}","${log.pattern.replace(/"/g, '""')}"`
  );
  fs.writeFileSync(csvPath, csvHeader + csvRows.join('\n'), 'utf8');
  console.log(`  📊 CSV de correções: ${csvPath} (${correctionsLog.length} registros)`);
}