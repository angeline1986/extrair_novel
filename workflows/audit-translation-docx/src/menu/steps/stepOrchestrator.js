// src/menu/steps/stepOrchestrator.js
// Orquestrador do workflow completo

import { log } from '../display.js';
import { askUser } from '../utils.js';
import { step1Audit } from './step1Audit.js';
import { step2FixGender } from './step2FixGender.js';
import { step3Organize } from './step3Organize.js';
import { step4Reaudit } from './step4Reaudit.js';
import { logWorkflowEvent } from '../../observability/workflowLog.js';
import { getCurrentStep } from '../../version/versionCore.js';

export async function runFullWorkflow() {
  const workflowStartTime = new Date();
  
  log('\n🚀 INICIANDO WORKFLOW COMPLETO', 'green');
  console.log('─'.repeat(64));
  console.log(`   ⏱️  Início: ${workflowStartTime.toLocaleString('pt-BR')}`);
  console.log('─'.repeat(64));
  
  const verbose = await askUser('Modo verbose? (S/N): ');
  const isVerbose = verbose === 's' || verbose === 'sim' || verbose === 'y';

  logWorkflowEvent('WORKFLOW_STARTED', {
    mode: verbose ? 'verbose' : 'normal',
    currentStep: getCurrentStep(),
    argv: process.argv.slice(2),
    cwd: process.cwd()
  });
  
  // PASSO 1: Auditoria
  const auditSuccess = await step1Audit(isVerbose);
  if (!auditSuccess) return false;
  
  // PASSO 2: Correção (opcional)
  const fix = await askUser('\n🔧 Deseja corrigir problemas de gênero? (s/N): ');
  if (fix !== 's' && fix !== 'sim' && fix !== 'y') {
    log('✨ Workflow concluído (sem correções).', 'green');
    return true;
  }
  
  await step2FixGender(isVerbose);
  
  // PASSO 3: Organizar versões
  await step3Organize();
  
  // PASSO 4: Re-auditoria opcional
  await step4Reaudit(isVerbose);
  
  // ============================================
  // RESUMO FINAL
  // ============================================
  const workflowEndTime = new Date();
  const duration = (workflowEndTime - workflowStartTime) / 1000;
  
  log('\n✅ WORKFLOW CONCLUÍDO!', 'green');
  console.log('─'.repeat(64));
  console.log(`   ⏱️  Duração total: ${duration} segundos`);
  console.log(`   ⏱️  Término: ${workflowEndTime.toLocaleString('pt-BR')}`);
  console.log('─'.repeat(64));
  
  log('\n📝 RESUMO DOS ARQUIVOS:', 'cyan');
  console.log(`   📁 Original preservado: input/translatedGoogle/ (NÃO MODIFICADO)`, 'green');
  console.log(`   📁 Versões corrigidas: input-fixed/v1/, v2/, v3/...`, 'cyan');
  console.log(`   📁 Última versão: input-fixed/current/`, 'cyan');
  console.log(`   📁 Relatórios: logs/`, 'cyan');
  
  // Mostrar caminho do arquivo final
  console.log(`\n   🎯 ARQUIVO FINAL CORRIGIDO:`);
  console.log(`      📁 workflows/audit-translation-docx/input-fixed/current/`);
  
  return true;
}
