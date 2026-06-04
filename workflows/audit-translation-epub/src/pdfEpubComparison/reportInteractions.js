export function reportInteractionScript(audit = {}) {
  const generatedAt = JSON.stringify(audit.generatedAt || null);
  const epubPath = JSON.stringify(audit.inputs?.epubTarget?.relativePath || audit.inputs?.epub?.filename || null);
  return `
    (function() {
      const reportGeneratedAt = ${generatedAt};
      const epubTarget = ${epubPath};
      const storageScope = [reportGeneratedAt || 'unknown-report', epubTarget || 'unknown-epub'].join('::');
      const storageKey = 'pdfEpubComparisonDecisions::' + storageScope;
      const load = () => JSON.parse(localStorage.getItem(storageKey) || '{}');
      const save = (value) => localStorage.setItem(storageKey, JSON.stringify(value));
      const countEl = document.getElementById('decision-count');
      const currentIds = new Set([...document.querySelectorAll('[data-review-id]')].map((item) => item.dataset.reviewId));

      function currentDecisions() {
        return Object.fromEntries(Object.entries(load()).filter(([id]) => currentIds.has(id)));
      }

      function updateCount() {
        if (!countEl) return;
        countEl.textContent = String(Object.keys(currentDecisions()).length);
      }

      function markRow(id, decision) {
        const panel = document.querySelector('[data-review-id="' + id + '"]');
        const status = document.querySelector('[data-decision-status="' + id + '"]');
        if (!panel || !status) return;
        panel.dataset.currentDecision = decision?.decision || '';
        status.textContent = decision ? decision.label : 'Sem decisão';
      }

      function setDecision(payload) {
        const decisions = currentDecisions();
        decisions[payload.id] = payload;
        save(decisions);
        markRow(payload.id, payload);
        updateCount();
      }

      function clearDecisionMarks() {
        document.querySelectorAll('[data-review-id]').forEach((panel) => {
          panel.dataset.currentDecision = '';
        });
        document.querySelectorAll('[data-decision-status]').forEach((status) => {
          status.textContent = 'Sem decisão';
        });
      }

      document.querySelectorAll('.decision-btn').forEach((button) => {
        button.addEventListener('click', () => {
          const panel = button.closest('.decision-panel');
          const id = button.dataset.id;
          const action = button.dataset.action;
          const input = panel?.querySelector('[data-manual-input="' + id + '"]');
          const manualValue = input?.value?.trim() || '';
          const to = action === 'manual' ? manualValue : button.dataset.to;
          if (action === 'manual' && !to) return;
          setDecision({
            id,
            decision: action === 'keep' ? 'keep' : 'apply',
            label: action === 'keep' ? button.dataset.label : 'Aplicar: ' + to,
            from: button.dataset.from || panel?.dataset.term || '',
            to: action === 'keep' ? '' : to,
            categoryId: panel?.dataset.categoryId || '',
            chapter: panel?.dataset.chapter || '',
            type: panel?.dataset.type || '',
            term: panel?.dataset.term || '',
          });
        });
      });

      document.getElementById('export-decisions')?.addEventListener('click', () => {
        const payload = {
          schemaVersion: '1.0',
          source: 'pdf_epub_comparison_report',
          reportGeneratedAt,
          epubTarget,
          exportedAt: new Date().toISOString(),
          decisions: Object.values(currentDecisions()),
        };
        const blob = new Blob([JSON.stringify(payload, null, 2) + '\\n'], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'pdf-epub-decisions-export.json';
        link.click();
        URL.revokeObjectURL(link.href);
      });

      document.getElementById('clear-decisions')?.addEventListener('click', () => {
        localStorage.removeItem(storageKey);
        clearDecisionMarks();
        updateCount();
      });

      save(currentDecisions());
      Object.entries(load()).forEach(([id, decision]) => markRow(id, decision));
      updateCount();
    })();
  `;
}
