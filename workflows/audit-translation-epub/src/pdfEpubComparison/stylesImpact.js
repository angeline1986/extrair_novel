export function impactStyles() {
  return `
    .impact {
      display: inline-block;
      min-width: 72px;
      padding: 6px 9px;
      border-radius: 5px;
      color: #fff;
      text-align: center;
      font-size: 0.78rem;
      font-weight: 800;
      text-transform: uppercase;
    }
    .impact-critical { background: #A53860; }
    .impact-high { background: #A53860; }
    .impact-medium { background: #DA627D; }
    .impact-low { background: #9f7986; }
    @media (max-width: 820px) {
      body { padding: 12px; }
      .container { width: calc(100vw - 24px); }
      .meta-grid { grid-template-columns: 1fr; }
      header { padding: 20px; }
      .tab-content { padding: 14px; }
      .tabs { grid-template-columns: 1fr; }
      .tab-btn { width: 100%; text-align: left; border-radius: 6px; }
    }
  `;
}
