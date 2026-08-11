// Relatorio HTML editorial para leitores/revisores nao tecnicos.

import fs from 'fs';
import path from 'path';
import {
  readerDecisionScript,
  readerDecisionStyles,
  renderReaderDecisionControls,
} from './epubReaderDecisionWidgets.js';
import { correctionStatePath, epubAuditStatePath } from './statePaths.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('pt-BR');
}

function readJsonIfExists(dir, filename) {
  if (!dir) return null;
  const filePath = path.join(dir, filename);
  if (!fs.existsSync(filePath)) return null;

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function readEpubAuditJson(name) {
  const filePath = epubAuditStatePath(name);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function readCorrectionJson(name) {
  const filePath = correctionStatePath(name);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function truncate(text, max = 360) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1).trim()}...`;
}

function pct(part, total) {
  if (!total) return 0;
  return Math.round((Number(part || 0) / Number(total || 1)) * 100);
}

function statusLabel({ report, postValidation, reviewQueue, assistedReview, semanticAudit }) {
  const issues = report?.stats?.totalIssues || 0;
  const warnings = report?.stats?.totalWarnings || 0;
  const semantic = semanticAudit?.summary?.total || 0;
  const available = assistedReview?.summary?.suggestionAvailable || 0;
  const pending = reviewQueue?.summary?.pending || 0;
  const epubValid = !postValidation || postValidation.status === 'OK';

  if (!epubValid || issues > 0) {
    return {
      label: 'Precisa de revisão pesada',
      tone: 'bad',
      text: 'Existe risco técnico ou estrutural que deve ser resolvido antes de tratar como versão boa para leitura.',
    };
  }

  if (semantic >= 30 || pending >= 20) {
    return {
      label: 'Precisa de revisão orientada',
      tone: 'warn',
      text: 'O EPUB parece tecnicamente utilizável, mas ainda há vários pontos semânticos que pedem revisão humana.',
    };
  }

  if (warnings > 0 || available > 0 || semantic > 0) {
    return {
      label: 'Precisa de revisão leve',
      tone: 'soft',
      text: 'A leitura deve ser possível, mas ainda há polimentos e sugestões localizadas a revisar.',
    };
  }

  return {
    label: 'Bom para leitura',
    tone: 'good',
    text: 'Nenhum problema relevante apareceu nos sinais atuais do pipeline.',
  };
}

function readingScores({ report, postValidation, reviewQueue, assistedReview, semanticAudit }) {
  const issues = report?.stats?.totalIssues || 0;
  const warnings = report?.stats?.totalWarnings || 0;
  const semantic = semanticAudit?.summary?.total || 0;
  const pending = reviewQueue?.summary?.pending || 0;
  const confirmed = postValidation?.correctionValidation?.confirmedCorrections || 0;
  const applied = postValidation?.correctionValidation?.appliedCorrections || 0;
  const available = assistedReview?.summary?.suggestionAvailable || 0;

  const technical = Math.max(1, 10 - issues * 3 - Math.min(3, warnings));
  const readability = Math.max(1, Math.min(10, 9 - Math.ceil(semantic / 15) - Math.ceil(pending / 25)));
  const consistency = Math.max(1, Math.min(10, 8 - Math.ceil((semanticAudit?.summary?.severity?.high || 0) * 1.5)));
  const revisionPotential = Math.max(1, Math.min(10, 5 + Math.ceil(available / 4) + (confirmed === applied && applied > 0 ? 1 : 0)));

  return { technical, readability, consistency, revisionPotential };
}

function classifyImpact(item) {
  const type = String(item?.type || '');
  const severity = String(item?.severity || '').toLowerCase();
  const reason = String(item?.reason || item?.notAppliedReason || '').toLowerCase();

  if (severity === 'high' || /omiss|sentido|drift|residual_english|english/.test(type + reason)) {
    return { label: 'alto', tone: 'bad' };
  }
  if (/semantic|gender|agreement|treatment|literal|terminolog|entity/.test(type + reason) || severity === 'medium') {
    return { label: 'medio', tone: 'warn' };
  }
  return { label: 'baixo', tone: 'soft' };
}

function actionText(item) {
  const status = item?.suggestionStatus || item?.status || 'pending';
  if (status === 'suggestion_available') return 'Revisar e aprovar se o trecho fizer sentido no contexto.';
  if (status === 'insufficient_context') return 'Ler o paragrafo/capitulo antes de decidir.';
  if (status === 'needs_human_translation') return 'Exige traducao/revisao humana.';
  if (status === 'approved') return 'Aprovado para aplicacao no proximo fix.';
  if (status === 'rejected') return 'Ignorado nesta rodada.';
  return 'Pendente de decisao humana.';
}

function renderPill(text, tone = 'soft') {
  return `<span class="pill ${tone}">${escapeHtml(text)}</span>`;
}

function renderExpandableSection(title, summary, content, { open = false } = {}) {
  return `
    <details class="expandable"${open ? ' open' : ''}>
      <summary>
        <span>${escapeHtml(title)}</span>
        <small>${escapeHtml(summary)}</small>
      </summary>
      <div class="expandable-body">
        ${content}
      </div>
    </details>`;
}

function renderMetric(label, value, note = '') {
  return `
    <div class="metric">
      <div class="metric-label">${escapeHtml(label)}</div>
      <div class="metric-value">${escapeHtml(String(value))}</div>
      <div class="metric-note">${escapeHtml(note)}</div>
    </div>`;
}

function renderScore(label, value, note = '') {
  const tone = value >= 8 ? 'good' : value >= 6 ? 'soft' : value >= 4 ? 'warn' : 'bad';
  return `
    <div class="score-card">
      <div>
        <div class="metric-label">${escapeHtml(label)}</div>
        <div class="metric-note">${escapeHtml(note)}</div>
      </div>
      <div class="score ${tone}">${formatNumber(value)}/10</div>
    </div>`;
}

function renderAppliedCorrections(correctionReport) {
  const corrections = correctionReport?.appliedCorrections || [];
  if (!corrections.length) {
    return '<div class="empty">Nenhuma correcao aplicada registrada nesta versao.</div>';
  }

  return corrections.slice(0, 12).map((item) => {
    const impact = classifyImpact(item);
    return `
      <article class="change-card">
        <div class="change-head">
          ${renderPill(item.type || 'correcao', impact.tone)}
          ${renderPill(`impacto ${impact.label}`, impact.tone)}
        </div>
        <div class="before-after">
          <div><strong>Antes</strong><p>${escapeHtml(truncate(item.before, 260))}</p></div>
          <div><strong>Depois</strong><p>${escapeHtml(truncate(item.after, 260))}</p></div>
        </div>
        <div class="where">${escapeHtml(item.filePath || '-')} · ${escapeHtml(item.nodeId || '-')}</div>
      </article>`;
  }).join('');
}

function appliedCorrectionsSummary(correctionReport) {
  const count = correctionReport?.appliedCorrections?.length || 0;
  if (!count) return 'nenhuma melhoria aplicada registrada';
  return `${formatNumber(count)} melhoria${count === 1 ? '' : 's'} aplicada${count === 1 ? '' : 's'}`;
}

function renderRecommendedSuggestions(assistedReview) {
  const suggestions = (assistedReview?.suggestions || [])
    .filter((item) => item.status === 'pending' && item.suggestionStatus === 'suggestion_available')
    .sort((a, b) => Number(b.confidence || 0) - Number(a.confidence || 0))
    .slice(0, 8);

  if (!suggestions.length) {
    return '<div class="empty">Nenhuma sugestao pronta para aprovacao apareceu nesta rodada. Foque nos itens que pedem contexto humano.</div>';
  }

  return suggestions.map((item) => {
    const impact = classifyImpact(item);
    return `
      <article class="suggestion-card">
        <div class="change-head">
          ${renderPill(`ID ${item.reviewQueueItemId || item.id || '-'}`, 'soft')}
          ${renderPill('Sugestao disponivel', 'good')}
          ${renderPill(item.status === 'pending' ? 'Aguardando decisao' : item.status, 'soft')}
          ${renderPill(humanTypeLabel(item.type), impact.tone)}
          ${renderPill(`impacto ${impact.label}`, impact.tone)}
        </div>
        <div class="context-block">
          <strong>Trecho atual</strong>
          <p>${escapeHtml(truncate(item.currentParagraph || item.before || item.textPreview, 520))}</p>
        </div>
        ${item.originalAlignedText ? `
          <div class="context-block muted">
            <strong>Original alinhado</strong>
            <p>${escapeHtml(truncate(item.originalAlignedText, 420))}</p>
          </div>` : ''}
        <div class="before-after">
          <div><strong>Antes</strong><p>${escapeHtml(truncate(item.before || item.targetBefore || '-', 260))}</p></div>
          <div><strong>Sugestao</strong><p>${escapeHtml(truncate(item.suggestedAfter || item.replacementAfter || '-', 260))}</p></div>
        </div>
        ${renderReaderDecisionControls(item)}
        <div class="action-line"><strong>Acao recomendada:</strong> ${escapeHtml(actionText(item))}</div>
        <div class="where">ID tecnico da sugestao: ${escapeHtml(item.id || '-')} · ${escapeHtml(item.filePath || '-')} · ${escapeHtml(item.nodeId || '-')}</div>
      </article>`;
  }).join('');
}

function humanTypeLabel(type = '') {
  if (/gender|agreement/.test(type)) return 'Possivel ajuste de concordancia';
  if (/treatment/.test(type)) return 'Possivel ajuste de tratamento';
  if (/terminolog/.test(type)) return 'Possivel ajuste de termo';
  if (/residual_english/.test(type)) return 'Possivel trecho em ingles';
  if (/repetition/.test(type)) return 'Possivel repeticao';
  if (/literal/.test(type)) return 'Possivel frase literal';
  return 'Sugestao de revisao';
}

function recommendedSuggestionsSummary(assistedReview) {
  const count = (assistedReview?.suggestions || [])
    .filter((item) => item.status === 'pending' && item.suggestionStatus === 'suggestion_available')
    .length;
  if (!count) return 'nenhuma candidata pronta nesta rodada';
  return `${formatNumber(count)} candidata${count === 1 ? '' : 's'} com sugestao concreta`;
}

function renderPendingGroups(reviewQueue, assistedReview, semanticAudit) {
  const queue = reviewQueue?.items || [];
  const suggestions = assistedReview?.suggestions || [];
  const semantic = semanticAudit?.semanticCandidates || [];
  const counts = new Map();

  for (const item of queue.filter((entry) => entry.status === 'pending')) {
    counts.set(item.type || 'desconhecido', (counts.get(item.type || 'desconhecido') || 0) + 1);
  }

  const rows = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([type, count]) => `<tr><td>${escapeHtml(type)}</td><td>${formatNumber(count)}</td><td>${escapeHtml(typeActionHint(type))}</td></tr>`)
    .join('');

  const summary = assistedReview?.summary || {};
  const semSummary = semanticAudit?.summary || {};

  return `
    <div class="metric-grid">
      ${renderMetric('Pendentes', formatNumber(reviewQueue?.summary?.pending || 0), 'itens aguardando decisao humana')}
      ${renderMetric('Sugestoes prontas', formatNumber(summary.suggestionAvailable || 0), 'podem virar lote pequeno de aprovacao')}
      ${renderMetric('Sem contexto suficiente', formatNumber(summary.insufficientContext || 0), 'pedem leitura manual')}
      ${renderMetric('Semanticos', formatNumber(semSummary.total || semantic.length), 'nunca entram como auto_safe')}
    </div>
    <table class="simple-table">
      <thead><tr><th>Tipo de pendencia</th><th>Qtd.</th><th>O que fazer</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="3">Nenhuma pendencia agrupada.</td></tr>'}</tbody>
    </table>`;
}

function typeActionHint(type = '') {
  if (/gender|agreement/.test(type)) return 'Conferir pronome/concordancia no paragrafo.';
  if (/treatment/.test(type)) return 'Conferir quem fala e como o personagem deve tratar o outro.';
  if (/terminolog|entity/.test(type)) return 'Comparar com glossario e nomes canonicos.';
  if (/literal/.test(type)) return 'Avaliar naturalidade em portugues.';
  if (/omission|drift|meaning/.test(type)) return 'Comparar com o original alinhado.';
  return 'Revisar o trecho e marcar aprovado/rejeitado.';
}

function renderSemanticExamples(semanticAudit) {
  const candidates = (semanticAudit?.semanticCandidates || [])
    .filter((item) => item.severity === 'high' || item.severity === 'medium')
    .slice(0, 10);

  if (!candidates.length) {
    return '<div class="empty">Nenhum candidato semantico medio/alto registrado.</div>';
  }

  return candidates.map((item) => {
    const impact = classifyImpact(item);
    return `
      <article class="issue-card">
        <div class="change-head">
          ${renderPill(item.severity || 'sem severidade', impact.tone)}
          ${renderPill(item.type || 'semantico', impact.tone)}
          ${renderPill(item.confidence || 'heuristico', 'soft')}
        </div>
        <p class="reason">${escapeHtml(item.reason || 'Revisar manualmente.')}</p>
        <div class="context-block">
          <strong>Traducao atual</strong>
          <p>${escapeHtml(truncate(item.context?.currentParagraph || item.context?.textPreview || '-', 500))}</p>
        </div>
        ${item.context?.originalAlignedText ? `
          <div class="context-block muted">
            <strong>Original alinhado</strong>
            <p>${escapeHtml(truncate(item.context.originalAlignedText, 420))}</p>
          </div>` : ''}
        <div class="action-line"><strong>Acao:</strong> comparar contexto antes de aprovar qualquer mudanca.</div>
        <div class="where">${escapeHtml(item.location?.filePath || '-')} · ${escapeHtml(item.location?.nodeId || '-')}</div>
      </article>`;
  }).join('');
}

function semanticExamplesSummary(semanticAudit) {
  const candidates = semanticAudit?.semanticCandidates || [];
  const mediumHigh = candidates.filter((item) => item.severity === 'high' || item.severity === 'medium').length;
  if (!mediumHigh) return 'nenhum risco medio/alto registrado';
  return `${formatNumber(mediumHigh)} exemplo${mediumHigh === 1 ? '' : 's'} medio/alto para leitura humana`;
}

function editorialFindingsSummary(editorialFindings) {
  const total = editorialFindings?.summary?.totalFindings || 0;
  const confirmed = editorialFindings?.summary?.confirmed || 0;
  const heuristic = editorialFindings?.summary?.heuristic || 0;
  if (!total) return 'nenhum achado editorial registrado';
  return `${formatNumber(total)} achado${total === 1 ? '' : 's'} editorial${total === 1 ? '' : 'is'} (${formatNumber(confirmed)} confirmados, ${formatNumber(heuristic)} heurísticos)`;
}

function renderEditorialCategory(cat) {
  const tone = cat.severity === 'high' ? 'bad' : cat.severity === 'medium' ? 'warn' : 'soft';
  const classificationLabel = cat.classification === 'confirmed' ? 'Confirmado' : 'Heurístico';

  return `
    <article class="issue-card">
      <div class="change-head">
        ${renderPill(cat.label, tone)}
        ${renderPill(cat.severity, tone)}
        ${renderPill(classificationLabel, cat.classification === 'confirmed' ? 'good' : 'soft')}
        ${renderPill(cat.confidence, 'soft')}
      </div>
      <p class="reason">${escapeHtml(cat.description)}</p>
      <div class="metric-grid">
        ${renderMetric('Ocorrências', formatNumber(cat.count), 'total detectado')}
      </div>
      ${cat.examples?.length ? `
        <div class="context-block">
          <strong>Exemplos</strong>
          ${cat.examples.slice(0, 5).map(ex => `<p>${escapeHtml(ex)}</p>`).join('')}
        </div>` : ''}
      ${cat.classification === 'heuristic' ? `
        <div class="action-line" style="color: #9a5b00;">
          <strong>Ação:</strong> Requer validação humana.
        </div>` : ''}
    </article>`;
}

function renderEditorialFindings(editorialFindings) {
  const categories = editorialFindings?.categories || [];
  if (!categories.length) {
    return '<div class="empty">Nenhum achado editorial detectado nesta rodada.</div>';
  }

  const confirmed = categories.filter(c => c.classification === 'confirmed');
  const heuristic = categories.filter(c => c.classification === 'heuristic');

  let html = '';

  // Aviso obrigatório
  html += `
    <div class="panel" style="background: #fbfaf7; border-color: #e4af3a; margin-bottom: 16px;">
      <p style="color: #9a5b00; font-size: 13px; margin: 0;">
        ⚠️ <strong>Atenção:</strong> Estes itens são <em>informativos</em> e <strong>não foram aplicados como correção automática</strong>.
      </p>
      <p style="color: #9a5b00; font-size: 13px; margin: 8px 0 0 0;">
        ℹ️ <strong>Itens classificados como heurísticos exigem validação humana.</strong>
      </p>
    </div>`;

  // Achados Confirmados
  if (confirmed.length) {
    html += '<h3 style="margin: 20px 0 10px; color: var(--text);">Achados Confirmados</h3>';
    html += confirmed.map(cat => renderEditorialCategory(cat)).join('');
  }

  // Achados Heurísticos
  if (heuristic.length) {
    html += '<h3 style="margin: 20px 0 10px; color: var(--text);">Achados Heurísticos</h3>';
    html += heuristic.map(cat => renderEditorialCategory(cat)).join('');
  }

  return html;
}

function renderNextSteps({ assistedReview, reviewQueue, semanticAudit }) {
  const available = assistedReview?.summary?.suggestionAvailable || 0;
  const pending = reviewQueue?.summary?.pending || 0;
  const insufficient = assistedReview?.summary?.insufficientContext || 0;
  const semantic = semanticAudit?.summary?.total || 0;
  const steps = [];

  if (available > 0) {
    const plural = available === 1 ? 'sugestao' : 'sugestoes';
    steps.push(`Na secao "Melhores candidatas", revisar ate ${Math.min(5, available)} ${plural} marcada como "Sugestao disponivel" e aprovar apenas se fizer sentido no contexto.`);
  }
  if (insufficient > 0) {
    steps.push('Separar itens "insufficient_context" para leitura humana; nao aplicar em massa.');
  }
  if (semantic > 0) {
    steps.push('Usar os candidatos semanticos como guia editorial, nunca como correcao automatica.');
  }
  if (pending > 0) {
    steps.push('Depois de aprovar o lote, rodar validacao da review queue e gerar novo EPUB corrigido.');
  }
  if (!steps.length) steps.push('Nenhuma acao imediata detectada nesta rodada.');

  return `<ol class="steps">${steps.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}</ol>`;
}

function buildReaderSummary({ report, correctionReport, postValidation, reauditoriaSummary, reviewQueue, assistedReview, semanticAudit, editorialFindings }) {
  const verdict = statusLabel({ report, postValidation, reviewQueue, assistedReview, semanticAudit });
  const scores = readingScores({ report, postValidation, reviewQueue, assistedReview, semanticAudit });
  const applied = correctionReport?.appliedCorrections?.length || 0;
  const confirmed = postValidation?.correctionValidation?.confirmedCorrections || 0;
  const textChanged = postValidation?.textComparison?.textChanged;
  const semanticTotal = semanticAudit?.summary?.total || 0;
  const available = assistedReview?.summary?.suggestionAvailable || 0;
  const pending = reviewQueue?.summary?.pending || 0;

  // Calcular saúde editorial (0-10)
  const editorialTotal = editorialFindings?.summary?.totalFindings || 0;
  const editorialHigh = editorialFindings?.summary?.high || 0;
  const editorialMedium = editorialFindings?.summary?.medium || 0;
  const editorialLow = editorialFindings?.summary?.low || 0;
  const editorialHealth = editorialTotal === 0 ? 10 : Math.max(0, Math.min(10, 10 - (editorialHigh * 2 + editorialMedium * 1 + editorialLow * 0.5) / 10));

  return {
    verdict,
    scores: {
      ...scores,
      editorialHealth: Math.round(editorialHealth * 10) / 10,
    },
    applied,
    confirmed,
    textChanged,
    semanticTotal,
    available,
    pending,
    improvement: reauditoriaSummary?.result || 'unknown',
    editorialTotal,
  };
}

export function writeEpubReaderReport(report, htmlPath, {
  stateDir,
  relativeWorkflowPath = (value) => value,
} = {}) {
  const correctionReport = readCorrectionJson('correctionReport');
  const postValidation = readCorrectionJson('postCorrectionValidation');
  const reauditoriaSummary = readCorrectionJson('reauditSummary');
  const reviewQueue = readEpubAuditJson('reviewQueue');
  const assistedReview = readEpubAuditJson('assistedReviewSuggestions');
  const semanticAudit = readEpubAuditJson('semanticCandidates');
  const editorialFindings = readEpubAuditJson('editorialFindings');
  const summary = buildReaderSummary({
    report,
    correctionReport,
    postValidation,
    reauditoriaSummary,
    reviewQueue,
    assistedReview,
    semanticAudit,
    editorialFindings,
  });
  const sourceFile = report?.stats?.sourceFile || report?.files?.[0]?.source?.name || '-';
  const translatedFile = report?.stats?.translatedFile || report?.files?.[0]?.translated?.name || '-';
  const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Relatorio editorial EPUB</title>
  <style>
    :root {
      --bg: #f6f7f9;
      --panel: #ffffff;
      --text: #1f2933;
      --muted: #607086;
      --border: #d8e0ea;
      --good: #177245;
      --soft: #2563a6;
      --warn: #9a5b00;
      --bad: #b42318;
      --good-bg: #e9f7ef;
      --soft-bg: #edf5ff;
      --warn-bg: #fff5dc;
      --bad-bg: #fdecec;
    }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--text); font: 15px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    main { max-width: 1180px; margin: 0 auto; padding: 32px 24px 56px; }
    header { display: grid; grid-template-columns: 1fr auto; gap: 20px; align-items: start; margin-bottom: 22px; }
    h1, h2, h3 { margin: 0; line-height: 1.2; }
    h1 { font-size: 30px; }
    h2 { font-size: 21px; margin-bottom: 10px; }
    h3 { font-size: 17px; margin: 22px 0 10px; }
    p { margin: 0; }
    section { margin-top: 20px; }
    .subtitle { color: var(--muted); margin-top: 6px; }
    .panel, .hero, .metric, .score-card, .change-card, .suggestion-card, .issue-card { background: var(--panel); border: 1px solid var(--border); border-radius: 8px; }
    .hero { padding: 22px; display: grid; grid-template-columns: 1.25fr .75fr; gap: 18px; align-items: center; }
    .verdict { font-size: 26px; font-weight: 800; margin-bottom: 8px; }
    .verdict.good { color: var(--good); }
    .verdict.soft { color: var(--soft); }
    .verdict.warn { color: var(--warn); }
    .verdict.bad { color: var(--bad); }
    .files { color: var(--muted); font-size: 13px; margin-top: 14px; }
    .metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 14px 0; }
    .metric { padding: 16px; }
    .metric-label { color: var(--muted); font-size: 12px; text-transform: uppercase; font-weight: 700; letter-spacing: .04em; }
    .metric-value { font-size: 26px; font-weight: 800; margin-top: 4px; }
    .metric-note { color: var(--muted); font-size: 13px; margin-top: 4px; }
    .scores { display: grid; gap: 10px; }
    .score-card { padding: 14px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .score { min-width: 76px; text-align: center; border-radius: 999px; padding: 8px 10px; font-weight: 800; }
    .score.good, .pill.good { background: var(--good-bg); color: var(--good); }
    .score.soft, .pill.soft { background: var(--soft-bg); color: var(--soft); }
    .score.warn, .pill.warn { background: var(--warn-bg); color: var(--warn); }
    .score.bad, .pill.bad { background: var(--bad-bg); color: var(--bad); }
    .pill { display: inline-flex; align-items: center; border-radius: 999px; padding: 4px 9px; font-size: 12px; font-weight: 700; }
    .expandable { background: var(--panel); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
    .expandable + .expandable { margin-top: 12px; }
    .expandable summary { cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 18px; font-weight: 800; font-size: 21px; list-style: none; }
    .expandable summary::-webkit-details-marker { display: none; }
    .expandable summary::before { content: "▸"; color: var(--soft); font-size: 18px; transition: transform .15s ease; }
    .expandable[open] summary::before { transform: rotate(90deg); }
    .expandable summary span { flex: 1; }
    .expandable summary small { color: var(--muted); font-size: 13px; font-weight: 600; text-align: right; }
    .expandable-body { border-top: 1px solid var(--border); padding: 6px 18px 18px; }
    .panel { padding: 18px; }
    .change-card, .suggestion-card, .issue-card { padding: 16px; margin-top: 12px; }
    .change-head { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
    .before-after { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; }
    .before-after > div, .context-block { background: #f9fbfd; border: 1px solid #e4eaf1; border-radius: 8px; padding: 12px; }
    .context-block.muted { background: #fbfaf7; }
    .before-after strong, .context-block strong { display: block; font-size: 12px; color: var(--muted); text-transform: uppercase; margin-bottom: 5px; }
    .where, .action-line, .reason { color: var(--muted); font-size: 13px; margin-top: 10px; }
    .simple-table { width: 100%; border-collapse: collapse; margin-top: 14px; background: var(--panel); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
    .simple-table th, .simple-table td { text-align: left; border-bottom: 1px solid var(--border); padding: 10px 12px; vertical-align: top; }
    .simple-table th { background: #edf1f6; font-size: 12px; text-transform: uppercase; color: #3d4b5f; }
    .empty { padding: 16px; background: var(--panel); border: 1px dashed var(--border); border-radius: 8px; color: var(--muted); }
    .steps { margin: 10px 0 0; padding-left: 22px; }
    .steps li { margin: 7px 0; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    @media (max-width: 860px) {
      main { padding: 22px 14px 40px; }
      header, .hero, .two-col, .before-after { grid-template-columns: 1fr; }
      .metric-grid { grid-template-columns: 1fr 1fr; }
    }
    @media (max-width: 560px) {
      .metric-grid { grid-template-columns: 1fr; }
    }
    ${readerDecisionStyles()}
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>Relatorio editorial da traducao EPUB</h1>
        <p class="subtitle">Visao amigavel para decidir se o EPUB esta bom para leitura e o que revisar em seguida.</p>
        <div class="reader-export">
          <span>Decisões marcadas: <strong id="reader-decision-count">0</strong></span>
          <button id="reader-export-decisions" type="button">Exportar decisões</button>
        </div>
      </div>
      ${renderPill(`Gerado em ${report?.timestamp || '-'}`, 'soft')}
    </header>

    <section class="hero">
      <div>
        <div class="verdict ${summary.verdict.tone}">${escapeHtml(summary.verdict.label)}</div>
        <p>${escapeHtml(summary.verdict.text)}</p>
        <div class="files">
          <div><strong>Original:</strong> ${escapeHtml(sourceFile)}</div>
          <div><strong>Traducao auditada:</strong> ${escapeHtml(translatedFile)}</div>
        </div>
      </div>
      <div class="scores">
        ${renderScore('Leiturabilidade', summary.scores.readability, 'quanto menor a pendencia semantica, melhor')}
        ${renderScore('Validade tecnica', summary.scores.technical, 'EPUB, estrutura e achados FAIL/WARN')}
        ${renderScore('Consistencia', summary.scores.consistency, 'nomes, tratamento, termos e sentido')}
        ${renderScore('Saúde editorial', summary.scores.editorialHealth, 'achados editoriais detectados')}
        ${renderScore('Potencial de proximo lote', summary.scores.revisionPotential, 'sugestoes boas para aprovar')}
      </div>
    </section>

    <section>
      <div class="metric-grid">
        ${renderMetric('Correcoes aplicadas', formatNumber(summary.applied), `${formatNumber(summary.confirmed)} confirmadas no texto final`)}
        ${renderMetric('Mudanca textual', summary.textChanged ? 'sim' : 'nao', `reauditoria: ${summary.improvement}`)}
        ${renderMetric('Sugestoes prontas', formatNumber(summary.available), 'candidatas para pequeno lote manual')}
        ${renderMetric('Pendencias humanas', formatNumber(summary.pending), 'nao sao aplicadas automaticamente')}
      </div>
    </section>

    <section class="panel">
      <h2>O que fazer agora</h2>
      ${renderNextSteps({ assistedReview, reviewQueue, semanticAudit })}
    </section>

    <section>
      ${renderExpandableSection(
        'Melhorias ja aplicadas',
        appliedCorrectionsSummary(correctionReport),
        renderAppliedCorrections(correctionReport),
        { open: true },
      )}
    </section>

    <section>
      ${renderExpandableSection(
        'Melhores candidatas para aprovar no proximo lote',
        recommendedSuggestionsSummary(assistedReview),
        renderRecommendedSuggestions(assistedReview),
        { open: true },
      )}
    </section>

    <section class="panel">
      <h2>O que ainda falta revisar</h2>
      ${renderPendingGroups(reviewQueue, assistedReview, semanticAudit)}
    </section>

    <section>
      ${renderExpandableSection(
        'Exemplos de risco semantico',
        semanticExamplesSummary(semanticAudit),
        renderSemanticExamples(semanticAudit),
      )}
    </section>

    <section>
      ${renderExpandableSection(
        'Achados editoriais informativos',
        editorialFindingsSummary(editorialFindings),
        renderEditorialFindings(editorialFindings),
        { open: false },
      )}
    </section>

    <section class="panel">
      <h2>Garantias de seguranca</h2>
      <div class="metric-grid">
        ${renderMetric('semantic_audit auto_safe', 'nao', 'exige aprovacao humana')}
        ${renderMetric('correcao automatica ampla', 'nao', 'sem reescrita sem aprovacao')}
        ${renderMetric('review queue', `${formatNumber(pct(reviewQueue?.summary?.approved || 0, reviewQueue?.summary?.totalItems || 0))}% aprovada`, 'somente approved entra no fix')}
        ${renderMetric('EPUB final', postValidation?.status || 'sem validacao', 'validacao tecnica pos-correcao')}
      </div>
    </section>
  </main>
  <script>${readerDecisionScript()}</script>
</body>
</html>`;

  fs.mkdirSync(path.dirname(htmlPath), { recursive: true });
  fs.writeFileSync(htmlPath, html, 'utf8');

  return {
    htmlPath,
    relativePath: relativeWorkflowPath(htmlPath),
  };
}
