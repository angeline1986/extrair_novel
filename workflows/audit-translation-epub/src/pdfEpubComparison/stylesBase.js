export function baseStyles() {
  return `
    :root {
      color-scheme: light;
      --bg: #fff6f0;
      --panel: #ffffff;
      --ink: #2b1320;
      --muted: #765669;
      --line: #f0c8cf;
      --head: #A53860;
      --accent: #A53860;
      --accent-soft: #F9DBBD;
      --rose: #DA627D;
      --candy: #FFA5AB;
      --warn: #A53860;
      --success-bg: #ecfff1;
      --success-line: #9fe3b3;
      --success-ink: #145b2b;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: var(--bg);
      color: var(--ink);
      line-height: 1.45;
      padding: 24px;
    }
    .container {
      width: min(1440px, calc(100vw - 48px));
      margin: 0 auto;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 18px 38px rgba(69, 9, 32, 0.12);
    }
    header { background: var(--head); color: #fff; padding: 24px 28px; min-height: 116px; }
    h1 { margin: 0 0 6px; font-size: 1.65rem; font-weight: 700; letter-spacing: 0; }
    header p { margin: 0; max-width: 900px; color: rgba(255,255,255,0.82); }
    .report-details {
      border-bottom: 1px solid var(--line);
      background: #fff7f3;
    }
    .report-details summary {
      cursor: pointer;
      padding: 13px 20px;
      color: #613247;
      font-weight: 800;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 1px;
      background: #f2ccd1;
      border-bottom: 1px solid var(--line);
    }
    .metric { background: #fff; padding: 18px 20px; min-width: 0; }
    .metric span {
      display: block;
      color: var(--muted);
      font-size: 0.78rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .metric strong { display: block; margin-top: 6px; overflow-wrap: anywhere; }
    .metric small { display: block; margin-top: 5px; color: var(--muted); }
    .details-note {
      padding: 12px 20px;
      color: #613247;
      background: #fff0e6;
      border-top: 1px solid var(--line);
      font-weight: 700;
      text-align: center;
    }
    footer {
      padding: 14px 22px;
      border-top: 1px solid var(--line);
      color: var(--muted);
      font-size: 0.82rem;
      background: #fff7f3;
    }
  `;
}
