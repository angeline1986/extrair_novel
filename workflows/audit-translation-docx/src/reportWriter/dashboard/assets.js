// src/reportWriter/dashboard/assets.js
// CSS e JS embutidos no dashboard HTML gerado.

export const dashboardStyles = `    :root {
      --bg: #0f172a;
      --panel: #111827;
      --panel-2: #1f2937;
      --text: #e5e7eb;
      --muted: #9ca3af;
      --border: #334155;
      --ok: #22c55e;
      --warn: #f59e0b;
      --fail: #ef4444;
      --info: #38bdf8;
      --chip: #0b1220;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: linear-gradient(135deg, #020617, #111827);
      color: var(--text);
    }

    header {
      padding: 28px 32px;
      border-bottom: 1px solid var(--border);
      background: rgba(15, 23, 42, 0.88);
      position: sticky;
      top: 0;
      z-index: 10;
      backdrop-filter: blur(10px);
    }

    h1, h2, h3 { margin: 0; }

    h1 {
      font-size: 26px;
      letter-spacing: 0;
    }

    .subtitle {
      margin-top: 8px;
      color: var(--muted);
      font-size: 14px;
    }

    main {
      padding: 28px 32px 60px;
      max-width: 1400px;
      margin: 0 auto;
    }

    .grid {
      display: grid;
      gap: 18px;
    }

    .grid-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .grid-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }

    .card {
      background: rgba(17, 24, 39, 0.9);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 18px;
      box-shadow: 0 18px 40px rgba(0,0,0,0.25);
    }

    .metric-label {
      color: var(--muted);
      font-size: 13px;
      margin-bottom: 8px;
    }

    .metric-value {
      font-size: 28px;
      font-weight: 800;
      letter-spacing: 0;
      overflow-wrap: anywhere;
    }

    .metric-note {
      margin-top: 8px;
      color: var(--muted);
      font-size: 12px;
    }

    .status {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 5px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      border: 1px solid;
      white-space: nowrap;
    }

    .status.fail { color: #fecaca; border-color: #7f1d1d; background: rgba(239, 68, 68, 0.13); }
    .status.warn { color: #fde68a; border-color: #78350f; background: rgba(245, 158, 11, 0.13); }
    .status.ok { color: #bbf7d0; border-color: #14532d; background: rgba(34, 197, 94, 0.13); }
    .status.info { color: #bae6fd; border-color: #075985; background: rgba(56, 189, 248, 0.13); }

    section { margin-top: 24px; }

    .section-title {
      display: flex;
      justify-content: space-between;
      align-items: end;
      margin-bottom: 12px;
      gap: 16px;
    }

    .section-title h2 {
      font-size: 20px;
      letter-spacing: 0;
    }

    .section-title p {
      margin: 4px 0 0;
      color: var(--muted);
      font-size: 13px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      overflow: hidden;
      border-radius: 8px;
      font-size: 14px;
    }

    th, td {
      padding: 12px 14px;
      border-bottom: 1px solid var(--border);
      text-align: left;
      vertical-align: top;
    }

    th {
      color: var(--muted);
      background: rgba(31, 41, 55, 0.75);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    tr:hover td { background: rgba(56, 189, 248, 0.05); }

    .expandable-row { cursor: pointer; }

    .row-toggle {
      width: 24px;
      height: 24px;
      margin-right: 10px;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: #020617;
      color: var(--text);
      font-weight: 800;
      line-height: 1;
      cursor: pointer;
    }

    .detail-row { display: none; }
    .detail-row.open { display: table-row; }
    .detail-row td {
      background: rgba(2, 6, 23, 0.45);
      padding: 0 14px 16px;
    }
    .detail-row:hover td { background: rgba(2, 6, 23, 0.45); }

    .detail-panel {
      margin-top: 10px;
      padding: 16px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: rgba(2, 6, 23, 0.55);
    }

    .detail-head {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
    }

    .detail-panel p {
      margin: 0 0 12px;
      color: #d1d5db;
      line-height: 1.5;
    }

    .detail-panel h4 {
      margin: 14px 0 8px;
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .detail-list {
      margin: 0;
      padding-left: 18px;
      color: #d1d5db;
      line-height: 1.6;
    }

    .examples {
      display: grid;
      gap: 10px;
      margin-top: 14px;
    }

    .example {
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
      background: rgba(15, 23, 42, 0.7);
    }

    .example .small { padding: 10px 12px 0; }

    .raw-detail {
      margin-top: 14px;
      background: rgba(15, 23, 42, 0.65);
    }

    .delta-good { color: var(--ok); font-weight: 700; }
    .delta-bad { color: var(--fail); font-weight: 700; }
    .delta-neutral { color: var(--muted); font-weight: 700; }

    .version-flow-card {
      background: rgba(17, 24, 39, 0.9);
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 18px 40px rgba(0,0,0,0.25);
    }

    .version-flow-header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
      padding: 18px;
      background: rgba(31, 41, 55, 0.55);
      border-bottom: 1px solid var(--border);
    }

    .version-flow-title {
      font-weight: 800;
      font-size: 20px;
      line-height: 1.4;
    }

    .version-flow-title small {
      display: block;
      margin-top: 4px;
      color: var(--muted);
      font-size: 13px;
      font-weight: 400;
    }

    .version-flow-body {
      padding: 18px;
    }

    .version-file-flow {
      display: grid;
      gap: 14px;
    }

    .version-file-flow + .version-file-flow {
      margin-top: 18px;
      padding-top: 18px;
      border-top: 1px solid var(--border);
    }

    .version-file-name {
      color: var(--text);
      font-weight: 800;
      overflow-wrap: anywhere;
    }

    .version-timeline {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 12px;
    }

    .flow-step {
      flex: 1;
      min-width: 140px;
      border-radius: 8px;
      padding: 14px 12px;
      text-align: center;
      border: 1px solid transparent;
    }

    .flow-step-title {
      font-weight: 800;
      font-size: 14px;
    }

    .flow-step-meta {
      margin-top: 5px;
      font-size: 12px;
      color: #cbd5e1;
    }

    .flow-step-file {
      margin-top: 5px;
      font-size: 11px;
      color: var(--muted);
      overflow-wrap: anywhere;
    }

    .flow-arrow,
    .flow-chain-arrow {
      font-size: 22px;
      align-self: center;
      color: var(--muted);
      font-weight: 800;
    }

    .origin { background: rgba(148, 163, 184, 0.12); border-color: #475569; }
    .normalize { background: rgba(99, 102, 241, 0.15); border-color: #6366f1; }
    .gender { background: rgba(245, 158, 11, 0.14); border-color: #92400e; }
    .version { background: rgba(34, 197, 94, 0.14); border-color: #166534; }
    .current { background: rgba(56, 189, 248, 0.14); border-color: #075985; }

    .flow-chain {
      margin-top: 4px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12px;
      background: rgba(2, 6, 23, 0.55);
      color: #cbd5e1;
      padding: 10px 12px;
      border-radius: 8px;
      border: 1px solid var(--border);
      overflow-wrap: anywhere;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-wrap: wrap;
      gap: 8px;
    }

    .flow-node {
      background: rgba(15, 23, 42, 0.95);
      padding: 6px 12px;
      border-radius: 999px;
      border: 1px solid var(--border);
      font-weight: 500;
    }

    .timeline {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .timeline.detailed {
      align-items: stretch;
      gap: 8px;
    }

    .file-flow {
      display: grid;
      gap: 12px;
    }

    .file-flow + .file-flow {
      margin-top: 18px;
      padding-top: 18px;
      border-top: 1px solid var(--border);
    }

    .file-flow h3 {
      font-size: 15px;
      color: var(--text);
    }

    .node {
      padding: 12px 14px;
      border-radius: 8px;
      background: var(--panel-2);
      border: 1px solid var(--border);
      min-width: 150px;
    }

    .path-node {
      min-width: 260px;
      max-width: 360px;
    }

    .stage-node {
      min-width: 150px;
      background: rgba(56, 189, 248, 0.08);
      border-color: #075985;
    }

    .node strong {
      display: block;
      font-size: 14px;
      overflow-wrap: anywhere;
    }

    .node span {
      color: var(--muted);
      font-size: 12px;
    }

    .arrow {
      color: var(--muted);
      font-weight: 800;
    }

    .entity-card { display: grid; gap: 10px; }

    .entity-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }

    .entity-head h3 { font-size: 18px; overflow-wrap: anywhere; }

    .bar {
      height: 10px;
      border-radius: 999px;
      background: #020617;
      overflow: hidden;
      border: 1px solid var(--border);
    }

    .bar > div {
      height: 100%;
      background: linear-gradient(90deg, var(--warn), var(--ok));
    }

    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .chip {
      padding: 5px 8px;
      border-radius: 999px;
      background: var(--chip);
      color: var(--muted);
      border: 1px solid var(--border);
      font-size: 12px;
    }

    details {
      border: 1px solid var(--border);
      border-radius: 8px;
      background: rgba(31, 41, 55, 0.45);
      overflow: hidden;
    }

    summary {
      cursor: pointer;
      padding: 14px 16px;
      font-weight: 700;
    }

    details[open] summary { border-bottom: 1px solid var(--border); }

    .inline-detail {
      background: rgba(2, 6, 23, 0.35);
    }

    .inline-detail summary {
      padding: 11px 12px;
      color: var(--text);
      font-size: 13px;
    }

    pre {
      margin: 0;
      padding: 16px;
      overflow-x: auto;
      color: #d1d5db;
      background: #020617;
      font-size: 12px;
      line-height: 1.55;
    }

    .diagnostics { display: grid; gap: 10px; }

    .diagnostic {
      padding: 13px 14px;
      border-radius: 8px;
      background: rgba(31, 41, 55, 0.65);
      border: 1px solid var(--border);
    }

    .diagnostic summary {
      display: flex;
      gap: 10px;
      align-items: flex-start;
      padding: 0;
      list-style: none;
    }

    .diagnostic summary::-webkit-details-marker { display: none; }
    .diagnostic[open] summary { border-bottom: 0; }
    .diagnostic .detail-panel { margin-top: 13px; }
    .diagnostic .small { display: block; margin-top: 3px; }

    .small {
      font-size: 12px;
      color: var(--muted);
    }

    .toolbar {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-bottom: 12px;
    }

    input, select {
      background: #020617;
      border: 1px solid var(--border);
      color: var(--text);
      padding: 10px 12px;
      border-radius: 8px;
      outline: none;
    }

    input { min-width: 280px; }

    @media (max-width: 960px) {
      .grid-4, .grid-2 { grid-template-columns: 1fr; }
      header, main { padding-left: 18px; padding-right: 18px; }
      .timeline { align-items: stretch; flex-direction: column; }
      .version-timeline { flex-direction: column; }
      .arrow { display: none; }
      .flow-arrow, .flow-chain-arrow { display: none; }
      .flow-step { min-width: 100%; text-align: left; }
      input { min-width: 100%; }
      .section-title { align-items: flex-start; flex-direction: column; }
    }`;

export const dashboardScript = `    const search = document.getElementById("search");
    const severity = document.getElementById("severity");
    const correctionRows = Array.from(document.querySelectorAll("#corrections tbody tr.expandable-row"));

    document.querySelectorAll(".expandable-row").forEach(row => {
      row.addEventListener("click", event => {
        const detail = document.getElementById(row.dataset.detail);
        const button = row.querySelector(".row-toggle");
        if (!detail) return;

        const isOpen = detail.classList.toggle("open");
        if (button) {
          button.textContent = isOpen ? "-" : "+";
          button.setAttribute("aria-expanded", String(isOpen));
        }
      });
    });

    function applyFilters() {
      const q = search.value.toLowerCase().trim();
      const s = severity.value;

      correctionRows.forEach(row => {
        const text = row.innerText.toLowerCase();
        const status = row.dataset.status;
        const visible = (!q || text.includes(q)) && (!s || status === s);
        const detail = document.getElementById(row.dataset.detail);
        const button = row.querySelector(".row-toggle");

        row.style.display = visible ? "" : "none";
        if (!visible && detail) {
          detail.classList.remove("open");
          detail.style.display = "none";
          if (button) {
            button.textContent = "+";
            button.setAttribute("aria-expanded", "false");
          }
        } else if (detail) {
          detail.style.display = "";
        }
      });
    }

    search.addEventListener("input", applyFilters);
    severity.addEventListener("change", applyFilters);`;
