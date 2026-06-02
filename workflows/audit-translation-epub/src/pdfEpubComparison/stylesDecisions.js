export function decisionStyles() {
  return `
    .decision-export {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 14px;
      padding: 12px 20px;
      background: #fff7f3;
      border-top: 1px solid var(--line);
      color: #613247;
      font-weight: 700;
    }
    .decision-export button,
    .decision-btn {
      border: 1px solid #d793a6;
      border-radius: 6px;
      background: #fff;
      color: #A53860;
      padding: 7px 10px;
      font-weight: 800;
      cursor: pointer;
    }
    .decision-export button:hover,
    .decision-btn:hover { background: #fff0f2; }
    .decision-panel {
      margin-top: 12px;
      padding: 11px;
      border: 1px solid #efd2d7;
      border-radius: 6px;
      background: #fffaf7;
    }
    .decision-panel > strong {
      display: block;
      margin-bottom: 8px;
      color: #613247;
      text-transform: uppercase;
      font-size: 0.78rem;
    }
    .decision-actions { display: flex; flex-wrap: wrap; gap: 8px; }
    .manual-decision {
      display: grid;
      grid-template-columns: 1fr;
      gap: 6px;
      margin-top: 10px;
      color: var(--muted);
      font-weight: 700;
    }
    .manual-decision input {
      width: 100%;
      border: 1px solid #e7b9c3;
      border-radius: 6px;
      padding: 8px 9px;
      color: var(--ink);
    }
    .decision-status {
      display: block;
      margin-top: 9px;
      color: #A53860;
      font-weight: 800;
    }
  `;
}
