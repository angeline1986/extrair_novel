export function navigationStyles() {
  return `
    .tabs {
      display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      gap: 4px;
      background: #fff0e6;
      padding: 12px 18px 0;
      border-bottom: 1px solid var(--line);
    }
    .tab-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      border: 0;
      border-radius: 6px 6px 0 0;
      padding: 12px 16px;
      background: transparent;
      color: #613247;
      cursor: pointer;
      font: inherit;
      font-weight: 700;
      letter-spacing: 0;
      min-height: 50px;
      white-space: nowrap;
    }
    .tab-btn span {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 28px;
      min-width: 28px;
      height: 22px;
      margin-left: 0;
      padding: 0 7px;
      border-radius: 999px;
      background: #F9DBBD;
      color: #A53860;
      font-size: 0.82rem;
    }
    .tab-btn.active {
      background: #fff;
      color: var(--accent);
      border-bottom: 3px solid var(--accent);
    }
    .tab-content {
      padding: 22px;
      overflow-x: auto;
      min-height: 760px;
    }
    .tab-pane { display: none; }
    .tab-pane.active-pane { display: block; }
    .note, .limit-notice {
      margin-bottom: 14px;
      padding: 12px 14px;
      border: 1px solid #f0cf9b;
      background: #fff8ec;
      color: #714513;
      border-radius: 6px;
      text-align: center;
      font-weight: 700;
    }
    .note {
      margin-top: 14px;
      margin-bottom: 10px;
      border-left: 4px solid var(--warn);
      text-align: left;
    }
    .limit-notice { margin-top: 10px; margin-bottom: 0; }
    code { overflow-wrap: anywhere; }
  `;
}
