import fs from "fs";
import path from "path";
import archiver from "archiver";
import { v4 as uuidv4 } from "uuid";
import {
  ensureDir,
  cleanDir,
  writeFile,
  escapeHtml,
  cleanText,
} from "../io/fileUtils.js";
import {
  readDocxText,
  parseVolumeFromDocx,
  sortDocxFiles,
  slugNumber,
} from "../io/docxReader.js";

// =====================================================
// Gera EPUB único a partir dos DOCX da pasta Traducao_corrigida/
// Estrutura esperada:
// Volume X
// Capítulo Y: ...
// parágrafos...
// =====================================================

const INPUT_DIR = path.join(process.cwd(), "Traducao_corrigida");
const COVER_FILE = path.join(process.cwd(), "cover2.jpg");

const OUTPUT_FILE = "Winter_Field_PTBR_corrigido.epub";

const BOOK_TITLE = "Winter Field";
const BOOK_AUTHOR = "straewgibl";
const BOOK_LANGUAGE = "pt-BR";
const BOOK_ID = uuidv4();

const BUILD_DIR = path.join(process.cwd(), "build_epub_docx");
const META_INF = path.join(BUILD_DIR, "META-INF");
const OEBPS = path.join(BUILD_DIR, "OEBPS");
const IMAGES = path.join(OEBPS, "images");

// helpers moved to src/io (fileUtils, docxReader)

// =====================================================
// PARSE DOCX -> VOLUME / CAPÍTULOS
// =====================================================

// =====================================================
// EPUB FIXOS
// =====================================================

function gerarMimetype() {
  writeFile(path.join(BUILD_DIR, "mimetype"), "application/epub+zip");
}

function gerarContainer() {
  ensureDir(META_INF);

  writeFile(
    path.join(META_INF, "container.xml"),
    `<?xml version="1.0"?>
<container version="1.0"
xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
<rootfiles>
<rootfile full-path="OEBPS/content.opf"
media-type="application/oebps-package+xml"/>
</rootfiles>
</container>`
  );
}

function gerarStylesheet() {
  writeFile(
    path.join(OEBPS, "stylesheet.css"),
    `
body {
  font-family: serif;
  line-height: 1.5;
  margin: 1em;
}

h1, h2, h3 {
  text-align: center;
}

p {
  text-indent: 1.5em;
  text-align: justify;
  margin: 0.6em 0;
}

.cover {
  text-align: center;
  margin: 0;
  padding: 0;
}

.cover img {
  max-width: 100%;
  max-height: 100%;
}

.title-page {
  text-align: center;
  margin-top: 30%;
}

.volume-page h1 {
  margin-top: 40%;
}

.chapter-title {
  margin-top: 1em;
  margin-bottom: 1.5em;
}
`
  );
}

function gerarCover() {
  if (!fs.existsSync(COVER_FILE)) {
    console.log("⚠️ cover2.jpg não encontrado. EPUB será gerado sem capa.");
    return false;
  }

  ensureDir(IMAGES);
  fs.copyFileSync(COVER_FILE, path.join(IMAGES, "cover.jpg"));

  writeFile(
    path.join(OEBPS, "cover.xhtml"),
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<title>Capa</title>
<link href="stylesheet.css" rel="stylesheet" type="text/css"/>
</head>
<body class="cover">
<img src="images/cover.jpg" alt="Capa"/>
</body>
</html>`
  );

  return true;
}

function gerarTitlePage() {
  writeFile(
    path.join(OEBPS, "title_page.xhtml"),
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<title>${escapeHtml(BOOK_TITLE)}</title>
<link href="stylesheet.css" rel="stylesheet" type="text/css"/>
</head>
<body class="title-page">
<h1>${escapeHtml(BOOK_TITLE)}</h1>
<h3>${escapeHtml(BOOK_AUTHOR)}</h3>
</body>
</html>`
  );
}

// =====================================================
// PÁGINAS DE VOLUME / CAPÍTULO
// =====================================================

function gerarPaginaVolume(volume, volumeIndex) {
  const fileName = `volume_${String(volumeIndex + 1).padStart(2, "0")}.xhtml`;

  writeFile(
    path.join(OEBPS, fileName),
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<title>${escapeHtml(volume.title)}</title>
<link href="stylesheet.css" rel="stylesheet" type="text/css"/>
</head>
<body class="volume-page">
<h1>${escapeHtml(volume.title)}</h1>
</body>
</html>`
  );

  return fileName;
}

function gerarPaginaCapitulo(chapter, globalIndex) {
  const fileName = `chapter_${String(globalIndex).padStart(4, "0")}.xhtml`;

  const paragraphsHtml = chapter.paragraphs
    .map(p => `<p>${escapeHtml(p)}</p>`)
    .join("\n");

  writeFile(
    path.join(OEBPS, fileName),
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<title>${escapeHtml(chapter.title)}</title>
<link href="stylesheet.css" rel="stylesheet" type="text/css"/>
</head>
<body>
<h2 class="chapter-title">${escapeHtml(chapter.title)}</h2>
${paragraphsHtml}
</body>
</html>`
  );

  return fileName;
}

// =====================================================
// NAV / NCX / OPF
// =====================================================

function gerarNav(volumes) {
  const items = volumes
    .map(
      volume => `
<li>
  <a href="${volume.file}">${escapeHtml(volume.title)}</a>
  <ol>
    ${volume.chapters
      .map(ch => `<li><a href="${ch.file}">${escapeHtml(ch.title)}</a></li>`)
      .join("\n")}
  </ol>
</li>`
    )
    .join("\n");

  writeFile(
    path.join(OEBPS, "nav.xhtml"),
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
<title>Índice</title>
<link href="stylesheet.css" rel="stylesheet" type="text/css"/>
</head>
<body>
<nav epub:type="toc" id="toc">
<h1>Índice</h1>
<ol>
${items}
</ol>
</nav>
</body>
</html>`
  );
}

function gerarTocNcx(volumes) {
  let playOrder = 1;

  const navPoints = volumes
    .map((volume, vIndex) => {
      const volumeOrder = playOrder++;

      const chapterPoints = volume.chapters
        .map((ch, cIndex) => {
          const chapterOrder = playOrder++;

          return `
<navPoint id="navPoint-v${vIndex + 1}-c${cIndex + 1}" playOrder="${chapterOrder}">
  <navLabel><text>${escapeHtml(ch.title)}</text></navLabel>
  <content src="${ch.file}"/>
</navPoint>`;
        })
        .join("\n");

      return `
<navPoint id="navPoint-v${vIndex + 1}" playOrder="${volumeOrder}">
  <navLabel><text>${escapeHtml(volume.title)}</text></navLabel>
  <content src="${volume.file}"/>
  ${chapterPoints}
</navPoint>`;
    })
    .join("\n");

  writeFile(
    path.join(OEBPS, "toc.ncx"),
    `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
<head>
<meta name="dtb:uid" content="${escapeHtml(BOOK_ID)}"/>
<meta name="dtb:depth" content="2"/>
<meta name="dtb:totalPageCount" content="0"/>
<meta name="dtb:maxPageNumber" content="0"/>
</head>
<docTitle><text>${escapeHtml(BOOK_TITLE)}</text></docTitle>
<navMap>
${navPoints}
</navMap>
</ncx>`
  );
}

function gerarContentOpf(volumes, hasCover) {
  const manifest = [
    `<item id="stylesheet" href="stylesheet.css" media-type="text/css"/>`,
    `<item id="titlepage" href="title_page.xhtml" media-type="application/xhtml+xml"/>`,
    `<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`,
    `<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>`,
  ];

  const spine = [];

  if (hasCover) {
    manifest.push(`<item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>`);
    manifest.push(`<item id="cover-image" href="images/cover.jpg" media-type="image/jpeg" properties="cover-image"/>`);
    spine.push(`<itemref idref="cover"/>`);
  }

  spine.push(`<itemref idref="titlepage"/>`);

  volumes.forEach((volume, vIndex) => {
    manifest.push(
      `<item id="volume${vIndex + 1}" href="${volume.file}" media-type="application/xhtml+xml"/>`
    );
    spine.push(`<itemref idref="volume${vIndex + 1}"/>`);

    volume.chapters.forEach(ch => {
      manifest.push(
        `<item id="chapter${ch.globalIndex}" href="${ch.file}" media-type="application/xhtml+xml"/>`
      );
      spine.push(`<itemref idref="chapter${ch.globalIndex}"/>`);
    });
  });

  writeFile(
    path.join(OEBPS, "content.opf"),
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="BookId">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:title>${escapeHtml(BOOK_TITLE)}</dc:title>
<dc:creator>${escapeHtml(BOOK_AUTHOR)}</dc:creator>
<dc:language>${escapeHtml(BOOK_LANGUAGE)}</dc:language>
<dc:identifier id="BookId">${escapeHtml(BOOK_ID)}</dc:identifier>
<meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d{3}Z$/, "Z")}</meta>
</metadata>
<manifest>
${manifest.join("\n")}
</manifest>
<spine toc="ncx">
${spine.join("\n")}
</spine>
</package>`
  );
}

// =====================================================
// ZIP EPUB
// =====================================================

function zipEpub() {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(OUTPUT_FILE);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", resolve);
    archive.on("error", reject);

    archive.pipe(output);

    // mimetype precisa ser primeiro e sem compressão
    archive.file(path.join(BUILD_DIR, "mimetype"), {
      name: "mimetype",
      store: true,
    });

    archive.directory(META_INF, "META-INF");
    archive.directory(OEBPS, "OEBPS");

    archive.finalize();
  });
}

// =====================================================
// MAIN
// =====================================================

async function main() {
  if (!fs.existsSync(INPUT_DIR)) {
    console.error(`❌ Pasta não encontrada: ${INPUT_DIR}`);
    process.exit(1);
  }

  const files = sortDocxFiles(
    fs.readdirSync(INPUT_DIR).filter(f => f.toLowerCase().endsWith(".docx"))
  );

  if (!files.length) {
    console.error(`❌ Nenhum .docx encontrado em: ${INPUT_DIR}`);
    process.exit(1);
  }

  cleanDir(BUILD_DIR);
  ensureDir(META_INF);
  ensureDir(OEBPS);

  gerarMimetype();
  gerarContainer();
  gerarStylesheet();

  const hasCover = gerarCover();
  gerarTitlePage();

  const volumes = [];
  let globalChapterIndex = 1;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filePath = path.join(INPUT_DIR, file);

    console.log(`📄 Lendo DOCX: ${file}`);

    const fullText = await readDocxText(filePath);
    const volume = parseVolumeFromDocx(file, fullText);

    if (!volume.chapters.length) {
      console.log(`⚠️ Nenhum capítulo detectado em ${file}. Pulando.`);
      continue;
    }

    volume.file = gerarPaginaVolume(volume, volumes.length);

    volume.chapters = volume.chapters.map(chapter => {
      const globalIndex = globalChapterIndex++;
      const chapterFile = gerarPaginaCapitulo(chapter, globalIndex);

      return {
        ...chapter,
        file: chapterFile,
        globalIndex,
      };
    });

    volumes.push(volume);
    console.log(`✅ ${volume.title}: ${volume.chapters.length} capítulos`);
  }

  if (!volumes.length) {
    console.error("❌ Nenhum volume válido foi gerado.");
    process.exit(1);
  }

  gerarNav(volumes);
  gerarTocNcx(volumes);
  gerarContentOpf(volumes, hasCover);

  await zipEpub();

  console.log(`\n✅ EPUB gerado com sucesso: ${path.resolve(OUTPUT_FILE)}`);
}

main().catch(err => {
  console.error("❌ Erro fatal:", err);
  process.exit(1);
});