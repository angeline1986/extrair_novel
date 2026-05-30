export function buildChapterRanges(boundaryReport, epub) {
  const boundaries = boundaryReport.chapters;
  if (!boundaries.length) {
    return { ok: false, rangeCount: 0, ranges: [] };
  }
  
  // Ordenar boundaries por chapterNumber
  const sortedBoundaries = [...boundaries].sort((a, b) => a.chapterNumber - b.chapterNumber);
  
  // Obter lista de arquivos do spine (excluindo frontmatter)
  const spineFiles = epub.spineItems
    .filter(item => isHtml(item.mediaType) && !isFrontmatter(item.href))
    .map((item, index) => ({
      href: item.href,
      fullPath: item.fullPath,
      spineIndex: index
    }));
  
  // Construir ranges para cada capítulo
  const ranges = [];
  
  for (let i = 0; i < sortedBoundaries.length; i++) {
    const current = sortedBoundaries[i];
    const next = sortedBoundaries[i + 1];
    
    // Determinar onde o capítulo termina
    let endFile, endSpineIndex, endNode, endNodeIndex, endDomPath, endBeforeChapterNumber;
    
    if (next) {
      // Capítulo termina imediatamente antes do próximo boundary
      endFile = next.startFile;
      endSpineIndex = next.spineIndex;
      endNode = next.node;
      endNodeIndex = next.nodeIndex;
      endDomPath = next.domPath;
      endBeforeChapterNumber = next.chapterNumber;
    } else {
      // Último capítulo termina no final do último arquivo
      const lastFile = spineFiles[spineFiles.length - 1];
      endFile = lastFile.href;
      endSpineIndex = lastFile.spineIndex;
      endNode = null;
      endNodeIndex = null;
      endDomPath = null;
      endBeforeChapterNumber = null;
    }
    
    // Determinar quais arquivos este capítulo atravessa
    const files = determineChapterFiles(current.spineIndex, endSpineIndex, spineFiles);
    
    ranges.push({
      chapterNumber: current.chapterNumber,
      title: current.title,
      startFile: current.startFile,
      startSpineIndex: current.spineIndex,
      startNode: current.node,
      startNodeIndex: current.nodeIndex,
      startDomPath: current.domPath,
      endFile: endFile,
      endSpineIndex: endSpineIndex,
      endNode: endNode,
      endNodeIndex: endNodeIndex,
      endDomPath: endDomPath,
      endBeforeChapterNumber: endBeforeChapterNumber,
      files: files,
      ok: true
    });
  }
  
  const ok = ranges.length === sortedBoundaries.length && ranges.every(r => r.ok);
  
  return {
    ok,
    rangeCount: ranges.length,
    ranges
  };
}

function determineChapterFiles(startSpineIndex, endSpineIndex, spineFiles) {
  const files = [];
  
  for (let i = startSpineIndex; i <= endSpineIndex; i++) {
    const file = spineFiles[i];
    if (file) {
      files.push({
        href: file.href,
        fullPath: file.fullPath,
        spineIndex: file.spineIndex
      });
    }
  }
  
  return files;
}

function isHtml(mediaType) {
  return ['application/xhtml+xml', 'text/html'].includes(mediaType);
}

function isFrontmatter(href) {
  return /titlepage|cover|copyright|dedication|toc|nav|index_split_000/.test(href);
}
