import path from 'node:path';

export function resolveReportOutputDir(root, options = {}, legacySubdir = null) {
  if (options.reportContext?.dataDir) return options.reportContext.dataDir;
  if (options.legacyOutputDir) return options.legacyOutputDir;

  // LEGACY FALLBACK: direct calls outside ReportContext keep the old locations.
  return legacySubdir ? path.join(root, 'reports', legacySubdir) : path.join(root, 'reports');
}
