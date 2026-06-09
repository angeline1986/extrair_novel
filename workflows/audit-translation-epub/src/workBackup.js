import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { resolveEpubTarget } from './epubTargetResolver.js';

function firstFile(dirPath, extension) {
  if (!fs.existsSync(dirPath)) return null;
  const name = fs.readdirSync(dirPath)
    .filter((entry) => entry.toLowerCase().endsWith(extension))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))[0];
  return name ? path.join(dirPath, name) : null;
}

function safeName(value) {
  return String(value || 'obra')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/_v\d+.*$/i, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'obra';
}

function timestampLabel(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('');
}

function addDirectoryIfPresent(archive, sourcePath, destination) {
  if (!fs.existsSync(sourcePath)) return;
  archive.glob('**/*', {
    cwd: sourcePath,
    dot: true,
    ignore: ['**/.DS_Store'],
  }, {
    prefix: destination,
  });
}

function addFileIfPresent(archive, sourcePath, destination) {
  if (sourcePath && fs.existsSync(sourcePath)) archive.file(sourcePath, { name: destination });
}

export async function createCompactWorkBackup({ workflowRoot } = {}) {
  if (!workflowRoot) throw new Error('workflowRoot e obrigatorio para criar backup.');

  const inputDir = path.join(workflowRoot, 'input');
  const manifestPath = path.join(workflowRoot, 'input-fixed/manifest.json');
  const backupsDir = path.join(workflowRoot, 'backups');
  const finalTarget = resolveEpubTarget({ workflowRoot });
  if (!finalTarget.filePath) throw new Error('Nenhum EPUB atual encontrado para o backup.');

  const translatedEpub = firstFile(path.join(inputDir, 'translated'), '.epub');
  const manifest = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    : {};
  const version = Number(manifest.currentVersion || finalTarget.version || 0) || null;
  const workName = safeName(path.basename(finalTarget.filePath, path.extname(finalTarget.filePath)));
  const filename = `${workName}_${timestampLabel()}_backup-enxuto.zip`;
  const outputPath = path.join(backupsDir, filename);

  fs.mkdirSync(backupsDir, { recursive: true });
  const output = fs.createWriteStream(outputPath);
  const archive = archiver('zip', { zlib: { level: 9 } });
  const completed = new Promise((resolve, reject) => {
    output.on('close', resolve);
    output.on('error', reject);
    archive.on('error', reject);
  });
  archive.pipe(output);

  const metadata = {
    schemaVersion: '1.0',
    backupType: 'compact_restorable_work',
    createdAt: new Date().toISOString(),
    workName,
    currentVersion: version,
    finalEpub: `epub/${path.basename(finalTarget.filePath)}`,
    translatedOriginal: translatedEpub ? `epub/original/${path.basename(translatedEpub)}` : null,
    included: [
      'epub final atual',
      'epub traduzido original, quando disponivel',
      'fontes da obra',
      'glossario',
      'log de traducao',
      'estado de auditoria e decisoes',
      'manifesto de versoes',
      'relatorios essenciais mais recentes',
    ],
    excluded: [
      'epubs intermediarios',
      'arquivos failed, misapplied e rejected',
      'pastas input-fixed de versoes anteriores',
      'logs tecnicos e relatorios antigos',
    ],
  };

  archive.append(`${JSON.stringify(metadata, null, 2)}\n`, { name: 'obra.json' });
  addFileIfPresent(archive, finalTarget.filePath, metadata.finalEpub);
  addFileIfPresent(
    archive,
    translatedEpub,
    translatedEpub ? `epub/original/${path.basename(translatedEpub)}` : null
  );
  addDirectoryIfPresent(archive, path.join(inputDir, 'source'), 'input/source');
  addDirectoryIfPresent(archive, path.join(inputDir, 'glossary'), 'input/glossary');
  addDirectoryIfPresent(archive, path.join(inputDir, 'translation-log'), 'input/translation-log');
  addDirectoryIfPresent(archive, path.join(workflowRoot, 'state'), 'state');
  addFileIfPresent(archive, manifestPath, 'input-fixed/manifest.json');
  addFileIfPresent(
    archive,
    path.join(workflowRoot, 'reports/html/pdf-epub-comparison-latest.html'),
    'reports/html/pdf-epub-comparison-latest.html'
  );
  addFileIfPresent(
    archive,
    path.join(workflowRoot, 'reports/html/reader-report-latest.html'),
    'reports/html/reader-report-latest.html'
  );
  addFileIfPresent(
    archive,
    path.join(workflowRoot, 'reports/txt/correcoes-editoriais-validadas.md'),
    'reports/txt/correcoes-editoriais-validadas.md'
  );

  await archive.finalize();
  await completed;
  return {
    outputPath,
    bytes: fs.statSync(outputPath).size,
    metadata,
  };
}
