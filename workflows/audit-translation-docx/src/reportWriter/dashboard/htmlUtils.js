// src/reportWriter/dashboard/htmlUtils.js
// Helpers pequenos para montar HTML seguro e consistente.

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function statusClass(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'ok' || normalized === 'pass' || normalized === 'success') return 'ok';
  if (normalized === 'warn' || normalized === 'warning') return 'warn';
  if (normalized === 'info') return 'info';
  return 'fail';
}

export function statusBadge(status, label = status) {
  return `<span class="status ${statusClass(status)}">${escapeHtml(label || status || 'N/A')}</span>`;
}

export function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '0';
  return Number(value).toLocaleString('pt-BR');
}

export function formatDelta(before, after) {
  if (before === null || before === undefined || after === null || after === undefined) {
    return { text: '-', className: 'delta-neutral' };
  }

  const delta = Number(after) - Number(before);
  if (delta === 0) return { text: '0', className: 'delta-neutral' };

  return {
    text: `${delta > 0 ? '+' : ''}${formatNumber(delta)}`,
    className: delta < 0 ? 'delta-good' : 'delta-bad',
  };
}

export function getDeltaValue(before, after) {
  if (before === null || before === undefined || after === null || after === undefined) return null;
  return Number(after) - Number(before);
}

export function getTrendLabel(before, after) {
  const delta = getDeltaValue(before, after);
  if (delta === null) return 'Sem base anterior';
  if (delta < 0) return 'Melhorou';
  if (delta > 0) return 'Piorou';
  return 'Sem mudança';
}

function detailList(items) {
  return `<ul class="detail-list">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

function renderExamples(examples = []) {
  if (!examples.length) return '';

  return `
    <div class="examples">
      ${examples.slice(0, 5).map((example) => example.context ? `
        <div class="example">
          <div class="small">Match: ${escapeHtml(example.match || 'sem match')}</div>
          <pre>${escapeHtml(example.context)}</pre>
        </div>` : `
        <div class="example">
          <div class="small">Antes</div>
          <pre>${escapeHtml(example.before || 'sem trecho')}</pre>
          <div class="small">Depois</div>
          <pre>${escapeHtml(example.after || 'sem trecho')}</pre>
        </div>`).join('')}
    </div>`;
}

export function renderDetailPanel({ title, status = 'INFO', evidence = [], interpretation = '', actions = [], raw = null, examples = [] }) {
  return `
    <div class="detail-panel">
      <div class="detail-head">
        ${statusBadge(status)}
        <strong>${escapeHtml(title)}</strong>
      </div>
      ${interpretation ? `<p>${escapeHtml(interpretation)}</p>` : ''}
      ${evidence.length ? `<h4>Evidência</h4>${detailList(evidence)}` : ''}
      ${actions.length ? `<h4>Direcionamento</h4>${detailList(actions)}` : ''}
      ${renderExamples(examples)}
      ${raw ? `<details class="raw-detail"><summary>Ver dados brutos deste item</summary><pre>${escapeHtml(JSON.stringify(raw, null, 2))}</pre></details>` : ''}
    </div>`;
}
