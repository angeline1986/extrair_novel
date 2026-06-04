export function tableStyles() {
  return `
    .table-wrapper {
      border: 1px solid #efc3cb;
      border-radius: 8px;
      overflow-x: auto;
      background: #fff;
    }
    .data-table {
      width: 100%;
      min-width: 1120px;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 0.92rem;
    }
    .col-impact { width: 120px; }
    .col-chapter-type { width: 190px; }
    .col-term { width: 170px; }
    .col-context { width: 35%; }
    .col-analysis { width: 35%; }
    th, td {
      padding: 20px 18px;
      border-bottom: 1px solid #efd2d7;
      vertical-align: top;
      text-align: left;
      overflow-wrap: anywhere;
    }
    th {
      background: #A53860;
      color: #fff;
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 14px 18px;
    }
    .impact-col { text-align: center; }
    .chapter-type-col strong { display: block; color: #2b1320; font-size: 1rem; }
    .chapter-type-col small { display: block; margin-top: 6px; color: #A53860; font-weight: 700; }
    .term-col code {
      display: inline-block;
      padding: 4px 9px;
      border: 1px solid #e7b9c3;
      border-radius: 5px;
      background: #fff7f3;
      color: #33202a;
      font-size: 0.9rem;
    }
    .context-col blockquote {
      margin: 0;
      padding: 2px 0 2px 16px;
      border-left: 3px solid #e5c7d1;
      color: #2b1320;
    }
    .context-col strong {
      background: #F9DBBD;
      color: #A53860;
      padding: 0 3px;
      border-radius: 3px;
    }
    .analysis-box { padding: 10px 12px; border-radius: 6px; line-height: 1.35; }
    .analysis-box + .analysis-box { margin-top: 10px; }
    .analysis-box strong {
      display: block;
      margin-bottom: 4px;
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .problem-box { background: #fff0f2; border: 1px solid #FFA5AB; color: #791c34; }
    .suggestion-box {
      background: var(--success-bg);
      border: 1px solid var(--success-line);
      color: var(--success-ink);
    }
    .decision-row td {
      padding: 0 18px 20px;
      background: #fffafa;
      border-bottom: 1px solid #efc3cb;
    }
    .finding-row td { border-bottom: 0; }
    .empty-cell { padding: 28px; text-align: center; color: var(--muted); }
    .finding-row:hover td { background: #fffafa; }
  `;
}
