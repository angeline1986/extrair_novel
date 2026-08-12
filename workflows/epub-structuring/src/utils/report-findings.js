export const SEVERITY = {
  ok: { label: 'OK', marker: '✓' },
  warning: { label: 'ATENÇÃO', marker: '⚠' },
  problem: { label: 'PROBLEMA', marker: '✗' },
  info: { label: 'INFORMAÇÃO', marker: 'ℹ' }
};

export function buildReportPresentation({ run = null, reports = {} }) {
  const findings = [
    ...findingsFromRun(run),
    ...findingsFromMenuValidation(reports['menu_epub_validation_report.json']),
    ...findingsFromStructure(reports),
    ...findingsFromValidation(reports),
    ...findingsFromReference(reports['chapter_integrity_report.json']),
    ...findingsFromPrechapter(reports),
    ...findingsFromMerge(reports),
    ...findingsFromTitles(reports['chapter_title_normalization_report.json']),
    ...findingsFromOrchestration(reports['m7_orchestration_report.json'])
  ];
  const result = buildResult(run, findings);
  return {
    result,
    findings,
    actions: buildSuggestedActions(result, findings)
  };
}

export function formatFindingForTerminal(finding) {
  const severity = SEVERITY[finding.severity] || SEVERITY.info;
  const action = finding.action ? ` Próxima ação: ${finding.action}` : '';
  return `${severity.marker} ${severity.label}: ${finding.title} — ${finding.message}${action}`;
}

function findingsFromRun(run) {
  if (!run) return [];
  if (run.status === 'success') {
    return [finding('ok', 'Execução concluída', 'A operação terminou com sucesso.', 'Nenhuma ação obrigatória.')];
  }
  if (run.status === 'running') {
    return [finding('info', 'Execução em andamento', 'O run ainda não foi finalizado.', 'Aguarde a conclusão da operação.')];
  }
  if (run.status === 'cancelled') {
    return [finding('info', 'Execução cancelada', 'A operação foi cancelada pelo usuário.', 'Execute novamente quando quiser gerar novos resultados.')];
  }
  if (run.status === 'blocked') {
    return [finding('warning', 'Execução bloqueada', 'A operação parou em um gate de segurança.', 'Revise os relatórios de precheck e os bloqueadores antes de repetir.')];
  }
  if (run.status === 'partial_success') {
    return [finding('warning', 'Execução parcial', 'Parte dos itens foi processada e parte falhou.', 'Revise os itens com erro antes de usar a saída final.')];
  }
  if (run.status === 'failed') {
    return [finding('problem', 'Execução falhou', run.error?.message || 'A operação terminou com erro.', 'Corrija o erro informado e execute novamente.')];
  }
  return [finding('info', 'Status registrado', `Status: ${run.status}.`, 'Revise os dados da execução.')];
}

function findingsFromMenuValidation(report) {
  if (!report?.checks) return [];
  return report.checks.map((check) => {
    if (check.ok === true) return finding('ok', check.label, 'Validação aprovada.', null, check.source);
    if (check.ok === false && check.warningOnly) return finding('warning', check.label, 'Validação requer atenção.', 'Revise o relatório técnico relacionado.', check.source);
    if (check.ok === false) return finding('problem', check.label, 'Validação falhou.', 'Corrija este item antes de considerar o EPUB aprovado.', check.source);
    return finding('info', check.label, check.unavailableReason || 'Validação indisponível neste contexto.', 'Execute o fluxo completo quando precisar desta validação.', check.source);
  });
}

function findingsFromStructure(reports) {
  const findings = [];
  const chapter = reports['chapter_report.json'];
  const toc = reports['toc_report.json'];
  const language = reports['language_report.json'];

  if (chapter) {
    if (chapter.chapterCount > 0) {
      findings.push(finding('ok', 'Capítulos detectados', `${chapter.chapterCount} capítulo(s) encontrados.`, 'Confira a sequência se houver suspeita de capítulos ausentes.', 'chapter_report.json'));
    } else {
      findings.push(finding('problem', 'Capítulos não detectados', 'Nenhum capítulo foi identificado.', 'Rode a detecção de capítulos e revise a fonte selecionada.', 'chapter_report.json'));
    }
  }

  if (toc) {
    const count = toc.entryCount ?? toc.entries?.length ?? 0;
    if (count > 0) findings.push(finding('ok', 'Sumário analisado', `${count} entrada(s) de sumário encontradas.`, null, 'toc_report.json'));
    if (toc.hasNcx === false) findings.push(finding('problem', 'NCX ausente', 'O EPUB não possui toc.ncx detectável.', 'Reconstrua o EPUB pelo fluxo completo antes de validar distribuição.', 'toc_report.json'));
    if (toc.hasNav === false) findings.push(finding('warning', 'NAV ausente', 'O EPUB não possui nav.xhtml detectável.', 'Use o fluxo de reconstrução EPUB 3 quando precisar de navegação EPUB 3 completa.', 'toc_report.json'));
  }

  if (language) {
    if (language.match === true) findings.push(finding('ok', 'Idioma coerente', `Idioma detectado: ${language.detectedLanguage || language.metadataLanguage}.`, null, 'language_report.json'));
    if (language.match === false || language.warning) findings.push(finding('warning', 'Idioma divergente', 'Metadata e conteúdo parecem indicar idiomas diferentes.', 'Revise a metadata do EPUB antes da versão final.', 'language_report.json'));
  }

  return findings;
}

function findingsFromValidation(reports) {
  const validations = [
    ['validation_report.json', reports['validation_report.json'], 'Validação EPUB 3'],
    ['final_regression_report.json', reports['final_regression_report.json'], 'Regressão final'],
    ['final_epub_validation.json', reports['final_epub_validation.json'], 'Auditoria final do EPUB']
  ];

  return validations.flatMap(([source, report, title]) => {
    if (!report) return [];
    if (report.ok === true) return [finding('ok', title, 'Nenhum erro bloqueante encontrado.', null, source)];
    if (report.ok === false) return [finding('problem', title, summarizeErrors(report), 'Abra o JSON técnico correspondente e corrija os erros antes de publicar.', source)];
    return [];
  });
}

function findingsFromReference(report) {
  if (!report) return [];
  if (report.status === 'OK') return [finding('ok', 'Auditoria de referência', 'Capítulos conferidos contra a referência disponível.', null, 'chapter_integrity_report.json')];
  if (report.status === 'STRUCTURAL_ONLY') return [finding('warning', 'Auditoria sem referência', 'Validação estrutural executada sem fonte externa.', 'Forneça EPUB/PDF de referência quando precisar de conferência de conteúdo.', 'chapter_integrity_report.json')];
  if (['FAILED', 'REVIEW_REQUIRED'].includes(report.status)) return [finding('problem', 'Auditoria de referência', 'A auditoria encontrou divergências ou exige revisão.', 'Revise os erros e warnings antes de seguir.', 'chapter_integrity_report.json')];
  return [finding('info', 'Auditoria de referência', `Status: ${report.status}.`, 'Revise o relatório técnico se necessário.', 'chapter_integrity_report.json')];
}

function findingsFromPrechapter(reports) {
  const findings = [];
  const batch = reports['batch_report.json'];
  if (batch?.summary) {
    const summary = batch.summary;
    if (summary.failed > 0) {
      findings.push(finding('problem', 'Correção pré-capítulo em lote', `${summary.failed} item(ns) falharam.`, 'Revise os itens failed antes de continuar para merge.', 'batch_report.json'));
    } else if (summary.ambiguous > 0 || summary.noBoundary > 0 || summary.unsupported > 0) {
      findings.push(finding('warning', 'Correção pré-capítulo em lote', 'Alguns EPUBs não foram classificados como seguros para correção automática.', 'Revise ambiguous, no_boundary e unsupported antes de usar esses arquivos no merge.', 'batch_report.json'));
    } else {
      findings.push(finding('ok', 'Correção pré-capítulo em lote', `${summary.fixed || 0} corrigido(s), ${summary.alreadyClean || 0} já limpo(s).`, null, 'batch_report.json'));
    }
  }

  for (const [name, report] of Object.entries(reports)) {
    if (!name.endsWith('-prechapter-analysis.json') && !name.endsWith('-prechapter-fix.json')) continue;
    if (report.status === 'candidate_found' && report.confidence === 'high') {
      findings.push(finding('warning', 'Conteúdo pré-capítulo detectado', 'Há candidato de alta confiança para correção.', 'Gere uma cópia corrigida antes de usar este EPUB em merge automático.', name));
    } else if (report.status === 'already_clean') {
      findings.push(finding('ok', 'Conteúdo pré-capítulo', 'O EPUB já parece limpo.', null, name));
    } else if (report.status === 'fixed') {
      findings.push(finding('ok', 'Correção pré-capítulo', 'Cópia corrigida gerada com sucesso.', null, name));
    } else if (report.status) {
      findings.push(finding('warning', 'Conteúdo pré-capítulo', `Status: ${report.status}.`, 'Revise o relatório técnico antes de seguir.', name));
    }
  }
  return findings;
}

function findingsFromMerge(reports) {
  const findings = [];
  const precheck = reports['merge_precheck_report.json'];
  const merge = reports['merge_report.json'];

  if (precheck) {
    if (precheck.status === 'ready_for_merge') {
      findings.push(finding('ok', 'Precheck de merge', `${precheck.sourceCount || 0} fonte(s) prontas para merge.`, null, 'merge_precheck_report.json'));
    } else {
      findings.push(finding('problem', 'Precheck de merge', `Status: ${precheck.status || 'bloqueado'}.`, 'Resolva gaps, overlaps, duplicatas ou erros antes de gerar EPUB unido.', 'merge_precheck_report.json'));
    }
  }

  if (merge) {
    if (merge.status === 'success' && merge.validation?.ok !== false) {
      findings.push(finding('ok', 'Merge de EPUBs', `${merge.chapterCount || 0} capítulo(s) unidos.`, null, 'merge_report.json'));
    } else {
      findings.push(finding('problem', 'Merge de EPUBs', `Status: ${merge.status || 'falhou'}.`, 'Revise validação e colisões de recursos antes de usar o EPUB final.', 'merge_report.json'));
    }
  }
  return findings;
}

function findingsFromTitles(report) {
  if (!report) return [];
  if (report.status === 'success') {
    return [finding('ok', 'Títulos dos capítulos', `${report.changed || 0} título(s) normalizados e ${report.unchanged || 0} preservado(s).`, null, 'chapter_title_normalization_report.json')];
  }
  if (report.status === 'preview') {
    return [finding('info', 'Títulos dos capítulos', `${report.changed || 0} título(s) seriam normalizados.`, 'Confirme a geração da cópia normalizada se o preview estiver correto.', 'chapter_title_normalization_report.json')];
  }
  return [finding('warning', 'Títulos dos capítulos', `Status: ${report.status || 'desconhecido'}.`, 'Revise o relatório antes de publicar.', 'chapter_title_normalization_report.json')];
}

function findingsFromOrchestration(report) {
  if (!report) return [];
  if (report.status === 'success') {
    return [finding('ok', 'Orquestração completa', 'Correção, merge, auditoria e títulos terminaram com sucesso.', null, 'm7_orchestration_report.json')];
  }
  if (report.status === 'blocked') {
    return [finding('warning', 'Orquestração bloqueada', `Bloqueio em ${report.blockedAt || 'gate de segurança'}.`, 'Revise os blockers antes de repetir o fluxo automático.', 'm7_orchestration_report.json')];
  }
  if (report.status === 'failed') {
    return [finding('problem', 'Orquestração falhou', `Falha em ${report.blockedAt || 'etapa desconhecida'}.`, 'Corrija a etapa indicada antes de repetir.', 'm7_orchestration_report.json')];
  }
  return [finding('info', 'Orquestração', `Status: ${report.status || 'desconhecido'}.`, 'Revise as etapas do relatório.', 'm7_orchestration_report.json')];
}

function buildResult(run, findings) {
  const hasProblem = findings.some((item) => item.severity === 'problem');
  const hasWarning = findings.some((item) => item.severity === 'warning');
  const status = hasProblem ? 'PROBLEMA' : hasWarning ? 'ATENÇÃO' : 'OK';
  return {
    status,
    runStatus: run?.status || null,
    problemCount: findings.filter((item) => item.severity === 'problem').length,
    warningCount: findings.filter((item) => item.severity === 'warning').length,
    okCount: findings.filter((item) => item.severity === 'ok').length,
    infoCount: findings.filter((item) => item.severity === 'info').length
  };
}

function buildSuggestedActions(result, findings) {
  const actions = findings
    .filter((item) => ['problem', 'warning'].includes(item.severity) && item.action)
    .map((item) => item.action);
  if (actions.length) return [...new Set(actions)];
  if (result.status === 'OK') return ['Nenhuma ação obrigatória. Arquive ou compare este relatório com execuções futuras.'];
  return ['Revise os relatórios técnicos disponíveis em data/.'];
}

function summarizeErrors(report) {
  const errors = report.errors || report.issues || [];
  if (!errors.length) return 'O relatório marcou falha sem detalhar erros.';
  return `${errors.length} erro(s): ${errors.slice(0, 3).map((item) => item.code || item.message || String(item)).join(', ')}.`;
}

function finding(severity, title, message, action = null, source = null) {
  return { severity, title, message, action, source };
}
