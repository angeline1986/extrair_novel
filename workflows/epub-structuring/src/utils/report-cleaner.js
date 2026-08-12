import fs from 'fs-extra';
import path from 'node:path';

export async function previewReportCleanup(root) {
  const reportsDir = path.join(root, 'reports');
  assertExpectedReportsDir(root, reportsDir);
  if (!(await fs.pathExists(reportsDir))) {
    return emptyResult(reportsDir);
  }
  await assertReportsDirSafe(reportsDir);

  const entries = await collectCleanableEntries(reportsDir);
  const totalBytes = entries.reduce((sum, entry) => sum + entry.bytes, 0);
  return {
    reportsDir,
    entries,
    entryCount: entries.length,
    totalBytes,
    formattedBytes: formatBytes(totalBytes)
  };
}

export async function cleanReports(root, options = {}) {
  if (options.confirm !== true) {
    return { ...await previewReportCleanup(root), status: 'cancelled', deletedCount: 0, freedBytes: 0, formattedFreedBytes: formatBytes(0) };
  }

  const preview = await previewReportCleanup(root);
  for (const entry of preview.entries) {
    await fs.remove(entry.path);
  }
  await fs.ensureDir(preview.reportsDir);
  const gitkeep = path.join(preview.reportsDir, '.gitkeep');
  if (!(await fs.pathExists(gitkeep))) await fs.writeFile(gitkeep, '');

  return {
    ...preview,
    status: 'cleaned',
    deletedCount: preview.entryCount,
    freedBytes: preview.totalBytes,
    formattedFreedBytes: preview.formattedBytes
  };
}

async function collectCleanableEntries(reportsDir) {
  const dirents = await fs.readdir(reportsDir, { withFileTypes: true });
  const entries = [];
  for (const dirent of dirents) {
    if (dirent.name === '.gitkeep') continue;
    const entryPath = path.join(reportsDir, dirent.name);
    const realReportsDir = await fs.realpath(reportsDir);
    const stat = await fs.lstat(entryPath);
    if (stat.isSymbolicLink()) continue;
    await assertInsideReports(realReportsDir, entryPath);
    entries.push({
      name: dirent.name,
      path: entryPath,
      bytes: await calculateEntryBytes(entryPath)
    });
  }
  return entries.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
}

async function calculateEntryBytes(entryPath) {
  const stat = await fs.lstat(entryPath);
  if (stat.isSymbolicLink()) return 0;
  if (!stat.isDirectory()) return stat.size;
  const dirents = await fs.readdir(entryPath, { withFileTypes: true });
  let total = 0;
  for (const dirent of dirents) {
    total += await calculateEntryBytes(path.join(entryPath, dirent.name));
  }
  return total;
}

function assertExpectedReportsDir(root, reportsDir) {
  const expected = path.resolve(root, 'reports');
  const actual = path.resolve(reportsDir);
  if (actual !== expected) throw new Error('INVALID_REPORTS_DIR');
}

async function assertReportsDirSafe(reportsDir) {
  const stat = await fs.lstat(reportsDir);
  if (stat.isSymbolicLink()) throw new Error('REPORTS_DIR_SYMLINK_REFUSED');
  if (!stat.isDirectory()) throw new Error('REPORTS_DIR_NOT_DIRECTORY');
}

async function assertInsideReports(realReportsDir, entryPath) {
  const resolved = await fs.realpath(entryPath);
  const relative = path.relative(realReportsDir, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('REPORT_CLEANUP_OUTSIDE_REPORTS');
}

function emptyResult(reportsDir) {
  return {
    reportsDir,
    entries: [],
    entryCount: 0,
    totalBytes: 0,
    formattedBytes: formatBytes(0)
  };
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
