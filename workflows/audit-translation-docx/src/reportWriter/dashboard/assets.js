// src/reportWriter/dashboard/assets.js
// CSS e JS embutidos no dashboard HTML gerado.

export const dashboardStyles = `    :root {
      --bg: #eef8ff;
      --panel: #ffffff;
      --panel-2: #f7fbff;
      --text: #0f172a;
      --muted: #52657c;
      --border: #d8e2ef;
      --brand: #216AC4;
      --brand-2: #61acf7;
      --brand-3: #0078d4;
      --brand-strong: #0A66C2;
      --brand-deep: #1e5a96;
      --surface-blue: #e0f2ff;
      --surface-blue-2: #d8ebff;
      --surface-blue-3: #eef4fb;
      --surface-blue-4: #d9eeff;
      --ok: #16a34a;
      --warn: #d97706;
      --fail: #dc2626;
      --info: #0078d4;
      --chip: #eef8ff;
      --shadow: 0 14px 32px rgba(33, 106, 196, 0.10);
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background:
        radial-gradient(circle at top left, rgba(97, 172, 247, 0.22), transparent 34%),
        linear-gradient(135deg, #f7fbff, #e0f2ff 44%, #eef4fb);
      color: var(--text);
    }

    header {
      padding: 28px 32px;
      border-bottom: 1px solid var(--border);
      background: rgba(247, 251, 255, 0.92);
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
      color: #52657c;
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
    .entity-grid { align-items: start; }

    .card {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 18px;
      box-shadow: var(--shadow);
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

    .status.fail { color: #991b1b; border-color: #fecaca; background: #fef2f2; }
    .status.warn { color: #92400e; border-color: #fde68a; background: #fffbeb; }
    .status.ok { color: #166534; border-color: #bbf7d0; background: #f0fdf4; }
    .status.info { color: var(--brand-deep); border-color: #b7dcff; background: #eef8ff; }

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
      background: #eef4fb;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    tr:hover td { background: #f7fbff; }

    .expandable-row { cursor: pointer; }

    .row-toggle {
      width: 24px;
      height: 24px;
      margin-right: 10px;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: #ffffff;
      color: var(--brand-deep);
      font-weight: 800;
      line-height: 1;
      cursor: pointer;
    }

    .detail-row { display: none; }
    .detail-row.open { display: table-row; }
    .detail-row td {
      background: #eef4fb;
      padding: 0 14px 16px;
    }
    .detail-row:hover td { background: #eef4fb; }

    .detail-panel {
      margin-top: 10px;
      padding: 16px;
      border: 1px solid var(--border);
      border-radius: 14px;
      background: #ffffff;
    }

    .detail-head {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
    }

    .detail-panel p {
      margin: 0 0 12px;
      color: #334155;
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
      color: #334155;
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
      background: #f7fbff;
    }

    .example .small { padding: 10px 12px 0; }

    .raw-detail {
      margin-top: 14px;
      background: #f7fbff;
    }

    .delta-good { color: var(--ok); font-weight: 700; }
    .delta-bad { color: var(--fail); font-weight: 700; }
    .delta-neutral { color: var(--muted); font-weight: 700; }

    .dashboard-tabs {
      margin-top: 0;
      margin-bottom: 24px;
    }

    .tab-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 6px;
      margin-bottom: 14px;
      border: 1px solid var(--border);
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.72);
      box-shadow: var(--shadow);
    }

    .tab-button {
      border: 1px solid transparent;
      border-radius: 12px;
      padding: 10px 14px;
      background: transparent;
      color: var(--brand-deep);
      font: inherit;
      font-weight: 800;
      cursor: pointer;
    }

    .tab-button.active {
      background: #ffffff;
      border-color: #b7dcff;
      color: var(--brand-strong);
      box-shadow: 0 8px 18px rgba(33, 106, 196, 0.10);
    }

    .tab-panel { display: none; }
    .tab-panel.active { display: block; }

    .empty-tab {
      padding: 18px;
      border: 1px dashed var(--border);
      border-radius: 14px;
      background: #f7fbff;
      color: var(--muted);
    }

    .compact-table-card {
      margin-top: 0;
    }

    .version-flow-card {
      background: #ffffff;
      border: 1px solid var(--border);
      border-radius: 28px;
      overflow: hidden;
      box-shadow: var(--shadow);
    }

    .version-flow-header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
      padding: 19px 28px;
      background: #f7fbff;
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
      border-radius: 24px;
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
      color: #475569;
    }

    .flow-step-file {
      margin-top: 5px;
      font-size: 11px;
      color: #64748b;
      overflow-wrap: anywhere;
    }

    .flow-arrow,
    .flow-chain-arrow {
      font-size: 22px;
      align-self: center;
      color: var(--muted);
      font-weight: 800;
    }

    .origin { background: #eef4fb; border-color: #d8e2ef; }
    .normalize { background: #e0f2ff; border-color: #61acf7; }
    .gender { background: #d8ebff; border-color: #61acf7; }
    .version { background: #d9eeff; border-color: #216AC4; }
    .current { background: #eef8ff; border-color: #0078d4; }

    .flow-chain {
      margin-top: 4px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12px;
      background: #eef4fb;
      color: var(--brand-deep);
      padding: 10px 12px;
      border-radius: 14px;
      border: 1px solid var(--border);
      overflow-wrap: anywhere;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-wrap: wrap;
      gap: 8px;
    }

    .flow-node {
      background: #ffffff;
      padding: 6px 12px;
      border-radius: 20px;
      border: 1px solid #d8e2ef;
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
      border-radius: 14px;
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
      background: #eef8ff;
      border-color: #61acf7;
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

    .entity-card {
      display: grid;
      gap: 10px;
      align-self: start;
      min-height: 0;
    }

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
      background: #d8e2ef;
      overflow: hidden;
      border: 1px solid var(--border);
    }

    .bar > div {
      height: 100%;
      background: linear-gradient(90deg, #61acf7, #216AC4);
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
      color: #52657c;
      border: 1px solid #d8e2ef;
      font-size: 12px;
    }

    details {
      border: 1px solid var(--border);
      border-radius: 14px;
      background: #ffffff;
      overflow: hidden;
    }

    summary {
      cursor: pointer;
      padding: 14px 16px;
      font-weight: 700;
    }

    details[open] summary { border-bottom: 1px solid var(--border); }

    .inline-detail {
      background: #f7fbff;
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
      color: #334155;
      background: #eef4fb;
      font-size: 12px;
      line-height: 1.55;
    }

    .diagnostics { display: grid; gap: 10px; }

    .diagnostic {
      padding: 13px 14px;
      border-radius: 14px;
      background: #ffffff;
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
      background: #ffffff;
      border: 1px solid var(--border);
      color: var(--text);
      padding: 10px 12px;
      border-radius: 10px;
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

    document.querySelectorAll(".tab-button").forEach(button => {
      button.addEventListener("click", () => {
        const target = document.getElementById(button.dataset.tab);
        if (!target) return;

        document.querySelectorAll(".tab-button").forEach(item => item.classList.remove("active"));
        document.querySelectorAll(".tab-panel").forEach(panel => panel.classList.remove("active"));
        button.classList.add("active");
        target.classList.add("active");
      });
    });

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

    if (search) search.addEventListener("input", applyFilters);
    if (severity) severity.addEventListener("change", applyFilters);`;
