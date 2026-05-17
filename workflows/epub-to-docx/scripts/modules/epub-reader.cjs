const path = require("path");
const cheerio = require("cheerio");

let zip = null;

function setZip(zipInstance) {
  zip = zipInstance;
}

function readZipText(filePath) {
  const entry = zip.getEntry(filePath);
  if (!entry) throw new Error(`Arquivo não encontrado no EPUB: ${filePath}`);
  return entry.getData().toString("utf8");
}

function loadOpfPath() {
  const containerXml = readZipText("META-INF/container.xml");
  const $ = cheerio.load(containerXml, { xmlMode: true });
  
  const rootfile = $("rootfile").attr("full-path");
  if (!rootfile) {
    throw new Error("Não foi possível encontrar rootfile em META-INF/container.xml");
  }
  return rootfile.replace(/\\/g, "/");
}

function loadSpineItems(opfPath) {
  const opfDir = path.dirname(opfPath);
  const opfContent = readZipText(opfPath);
  const $ = cheerio.load(opfContent, { xmlMode: true });
  
  const manifestMap = new Map();
  $("manifest item").each((_, item) => {
    const id = $(item).attr("id");
    const href = $(item).attr("href");
    const mediaType = $(item).attr("media-type");
    if (id && href) {
      manifestMap.set(id, { href, mediaType });
    }
  });
  
  const spineItems = [];
  let position = 0;
  
  $("spine itemref").each((_, itemref) => {
    const idref = $(itemref).attr("idref");
    if (!idref) return;
    
    const manifestItem = manifestMap.get(idref);
    if (!manifestItem) {
      console.warn(`Aviso: idref "${idref}" não encontrado no manifest`);
      return;
    }
    
    const { href, mediaType } = manifestItem;
    const isTextual = mediaType && (
      mediaType === "application/xhtml+xml" ||
      mediaType === "text/html" ||
      /\.(x?html?|htm)$/i.test(href)
    );
    
    if (!isTextual) return;
    
    const fullPath = path.normalize(path.join(opfDir, href)).replace(/\\/g, "/");
    position++;
    
    spineItems.push({
      id: idref,
      path: fullPath,
      mediaType,
      position,
      title: "",
    });
  });
  
  console.log(`Itens textuais no spine (ordem de leitura): ${spineItems.length}`);
  return spineItems;
}

function loadTocItems() {
  const tocPath = zip
    .getEntries()
    .map((entry) => entry.entryName)
    .find((name) => name.toLowerCase().endsWith("toc.ncx"));

  if (!tocPath) {
    throw new Error("toc.ncx não encontrado no EPUB.");
  }

  const tocDir = path.dirname(tocPath);
  const tocXml = readZipText(tocPath);
  const $toc = cheerio.load(tocXml, { xmlMode: true });

  const items = [];

  $toc("navPoint").each((_, el) => {
    const title = (() => {
      const text = $toc(el).children("navLabel").children("text").first().text();
      return String(text || "").trim().replace(/\s+/g, " ");
    })();

    const src = $toc(el).children("content").attr("src");
    if (!src) return;

    const cleanSrc = src.split("#")[0];
    const fullPath = path.normalize(path.join(tocDir, cleanSrc)).replace(/\\/g, "/");
    items.push({ title, path: fullPath });
  });

  return items;
}

function mergeTocMetadataIntoSpineItems(spineItems, tocItems) {
  const tocTitleMap = new Map();
  
  for (const tocItem of tocItems) {
    const normalizedPath = tocItem.path.replace(/\\/g, "/");
    tocTitleMap.set(normalizedPath, tocItem.title);
  }
  
  const mergedItems = spineItems.map(item => ({
    ...item,
    title: tocTitleMap.get(item.path) || "",
  }));
  
  const matchedCount = mergedItems.filter(item => item.title).length;
  console.log(`${matchedCount}/${mergedItems.length} itens do spine têm título correspondente no TOC`);
  
  return mergedItems;
}

module.exports = {
  setZip,
  readZipText,
  loadOpfPath,
  loadSpineItems,
  loadTocItems,
  mergeTocMetadataIntoSpineItems,
};