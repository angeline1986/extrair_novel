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
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px 12px;
      padding: 0;
      border: 0;
      background: transparent;
    }
    .decision-panel + .decision-panel {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px dashed #e7b9c3;
    }
    .decision-panel > strong {
      color: #613247;
      text-transform: uppercase;
      font-size: 0.78rem;
      white-space: nowrap;
    }
    .decision-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }
    .decision-btn {
      max-width: 280px;
      white-space: normal;
      line-height: 1.2;
    }
    .manual-decision {
      display: flex;
      flex: 1 1 360px;
      min-width: 280px;
      align-items: center;
      gap: 8px;
      color: var(--muted);
      font-weight: 700;
    }
    .manual-decision span { white-space: nowrap; }
    .manual-decision input {
      flex: 1 1 180px;
      min-width: 140px;
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
      .manual-decision { flex-direction: column; align-items: stretch; }
      .manual-decision span { white-space: normal; }
      .decision-status { white-space: normal; }
    }
  `;
}
