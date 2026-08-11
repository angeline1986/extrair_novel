function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function compact(value, limit = 120) {
  const text = String(value || '-').replace(/\s+/g, ' ').trim();
  return text.length > limit ? `${text.slice(0, limit - 3).trim()}...` : text;
}

export function renderReaderDecisionControls(item) {
  const id = item.id || item.reviewQueueItemId || '';
  const reviewQueueItemId = item.reviewQueueItemId || item.id || '';
  const before = item.before || item.targetBefore || '';
  const after = item.suggestedAfter || item.replacementAfter || '';
  if (!id || !before || !after) return '';

  return `
    <div class="reader-decision" data-reader-review-id="${escapeHtml(id)}" data-review-queue-item-id="${escapeHtml(reviewQueueItemId)}">
      <strong>Decisão</strong>
      <div class="reader-decision-actions">
        <button type="button" data-reader-action="keep" data-id="${escapeHtml(id)}" data-before="${escapeHtml(before)}">1. ${escapeHtml(compact(before))}</button>
        <button type="button" data-reader-action="apply" data-id="${escapeHtml(id)}" data-before="${escapeHtml(before)}" data-after="${escapeHtml(after)}">2. ${escapeHtml(compact(after))}</button>
      </div>
      <label>
        <span>Editar manualmente</span>
        <input type="text" data-reader-manual="${escapeHtml(id)}" placeholder="Informe a correção">
        <button type="button" data-reader-action="manual" data-id="${escapeHtml(id)}" data-before="${escapeHtml(before)}">Confirmar</button>
      </label>
      <small data-reader-status="${escapeHtml(id)}">Sem decisão</small>
    </div>`;
}

export function readerDecisionStyles() {
  return `
    .reader-export { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-top: 12px; }
    .reader-export button,
    .reader-decision button {
      border: 1px solid var(--border);
      border-radius: 6px;
      background: #fff;
      color: var(--soft);
      padding: 7px 10px;
      font-weight: 800;
      cursor: pointer;
    }
    .reader-decision { margin-top: 12px; padding: 12px; border: 1px solid var(--border); border-radius: 8px; background: #fbfdff; }
    .reader-decision > strong { display: block; margin-bottom: 8px; color: var(--soft); text-transform: uppercase; font-size: 12px; }
    .reader-decision-actions { display: flex; flex-wrap: wrap; gap: 8px; }
    .reader-decision label { display: grid; gap: 6px; margin-top: 10px; color: var(--muted); font-weight: 700; }
    .reader-decision input { width: 100%; border: 1px solid var(--border); border-radius: 6px; padding: 8px 9px; }
    .reader-decision small { display: block; margin-top: 8px; color: var(--soft); font-weight: 800; }
  `;
}

export function readerDecisionScript() {
  return `
    (function() {
      const key = 'epubReaderReportDecisions';
      const load = () => JSON.parse(localStorage.getItem(key) || '{}');
      const save = (value) => localStorage.setItem(key, JSON.stringify(value));
      const countEl = document.getElementById('reader-decision-count');
      function updateCount() { if (countEl) countEl.textContent = String(Object.keys(load()).length); }
      function mark(id, decision) {
        const status = document.querySelector('[data-reader-status="' + id + '"]');
        if (status) status.textContent = decision ? decision.label : 'Sem decisão';
      }
      document.querySelectorAll('[data-reader-action]').forEach((button) => {
        button.addEventListener('click', () => {
          const id = button.dataset.id;
          const action = button.dataset.readerAction;
          const manual = document.querySelector('[data-reader-manual="' + id + '"]')?.value?.trim() || '';
          const after = action === 'manual' ? manual : button.dataset.after;
          if (action !== 'keep' && !after) return;
          const decisions = load();
          decisions[id] = {
            id,
            reviewQueueItemId: button.closest('.reader-decision')?.dataset.reviewQueueItemId || id,
            decision: action === 'keep' ? 'keep' : 'apply',
            label: action === 'keep' ? 'Manter texto atual' : 'Aplicar: ' + after,
            before: button.dataset.before || '',
            after: action === 'keep' ? '' : after,
          };
          save(decisions);
          mark(id, decisions[id]);
          updateCount();
        });
      });
      document.getElementById('reader-export-decisions')?.addEventListener('click', () => {
        const payload = { schemaVersion: '1.0', source: 'epub_reader_report', exportedAt: new Date().toISOString(), decisions: Object.values(load()) };
        const blob = new Blob([JSON.stringify(payload, null, 2) + '\\n'], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'reader-report-decisions-export.json';
        link.click();
        URL.revokeObjectURL(link.href);
      });
      Object.entries(load()).forEach(([id, decision]) => mark(id, decision));
      updateCount();
    })();
  `;
}
