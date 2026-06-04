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
      display: grid;
      grid-template-columns: auto auto auto minmax(260px, 1fr) auto;
      align-items: center;
      gap: 10px;
      padding: 0;
      border: 0;
      background: transparent;
    }
    .decision-panel > strong {
      color: #613247;
      text-transform: uppercase;
      font-size: 0.78rem;
      white-space: nowrap;
    }
    .decision-actions { display: contents; }
    .manual-decision {
      display: grid;
      grid-template-columns: auto minmax(160px, 1fr) auto;
      align-items: center;
      gap: 8px;
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
      color: #A53860;
      font-weight: 800;
      white-space: nowrap;
    }
    @media (max-width: 900px) {
      .decision-panel { grid-template-columns: 1fr; align-items: stretch; }
      .decision-actions { display: flex; flex-wrap: wrap; }
      .manual-decision { grid-template-columns: 1fr; }
      .decision-status { white-space: normal; }
    }
  `;
}
