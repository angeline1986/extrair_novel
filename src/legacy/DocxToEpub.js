
import fs from "fs";
import path from "path";
import mammoth from "mammoth";
import archiver from "archiver";
import { v4 as uuidv4 } from "uuid";

// ---------------- CONFIG ----------------
const INPUT_DOCX = "Novel_JFLT_ptbr.docx";   // arquivo de entrada
const OUTPUT_FILE = "Everywhere_in_Jianghu_Is_Wonderful.epub";  // nome do EPUB final

const BOOK_TITLE = "Everywhere in Jianghu Is Wonderful";
const BOOK_AUTHOR = "Tang Jiuqing";
const BOOK_LANGUAGE = "pt-BR";
const BOOK_ID = uuidv4();

const COVER_SOURCE_FILE = path.join(process.cwd(), "cover.jpg");

// ---------------- HELPERS ----------------
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
function writeFile(file, content) {
  fs.writeFileSync(file, content, "utf8");
}

// ---------------- EPUB STRUCTURE ----------------
function gerarMimetype(baseDir) {
  writeFile(path.join(baseDir, "mimetype"), "application/epub+zip");
}
function gerarContainer(metaInfDir) {
  ensureDir(metaInfDir);
  const xml = `<?xml version="1.0"?>
<container version="1.0"
  xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf"
      media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
  writeFile(path.join(metaInfDir, "container.xml"), xml);
}
function gerarStylesheet(oebpsDir) {
  const css = `body { font-family: serif; line-height: 1.5; margin: 1em; }
h3 { text-align: center; margin: 1em 0; }
p { text-indent: 1.5em; margin: 0.5em 0; }
.fff_chapter_title { margin-top: 0.5em; }`;
  writeFile(path.join(oebpsDir, "stylesheet.css"), css);
}
function gerarCover(oebpsDir) {
  const html = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Cover</title>
<style type="text/css">body{text-align:center;margin:0;padding:0;}</style>
</head>
<body><div><img src="images/cover.jpg" alt="cover"/></div></body>
</html>`;
  writeFile(path.join(oebpsDir, "cover.xhtml"), html);
}
function gerarTitlePage(oebpsDir) {
  const html = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>${BOOK_TITLE}</title>
<link href="stylesheet.css" rel="stylesheet" type="text/css"/>
</head>
<body class="fff_titlepage">
<h3>${BOOK_TITLE} — ${BOOK_AUTHOR}</h3>
</body></html>`;
  writeFile(path.join(oebpsDir, "title_page.xhtml"), html);
}

// ---------------- TOC ----------------
function gerarNav(oebpsDir, chapters) {
  const items = chapters.map(
    (c, i) => `<li><a href="file${String(i + 1).padStart(4, "0")}.xhtml">${c.title}</a></li>`
  );
  const html = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Índice</title>
<link href="stylesheet.css" rel="stylesheet" type="text/css"/>
</head>
<body><nav epub:type="toc"><h2>Índice</h2><ol>${items.join("\n")}</ol></nav></body>
</html>`;
  writeFile(path.join(oebpsDir, "nav.xhtml"), html);
}
function gerarTocNcx(oebpsDir, chapters) {
  const navPoints = chapters
    .map(
      (c, i) => `<navPoint id="navPoint-${i + 1}" playOrder="${i + 1}">
      <navLabel><text>${c.title}</text></navLabel>
      <content src="file${String(i + 1).padStart(4, "0")}.xhtml"/>
    </navPoint>`
    )
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${BOOK_ID}"/>
    <meta name="dtb:depth" content="1"/>
  </head>
  <docTitle><text>${BOOK_TITLE}</text></docTitle>
  <navMap>${navPoints}</navMap>
</ncx>`;
  writeFile(path.join(oebpsDir, "toc.ncx"), xml);
}

// ---------------- OPF ----------------
function gerarContentOpf(oebpsDir, chapters, temCapa) {
  const manifestItems = [
    `<item id="css" href="stylesheet.css" media-type="text/css"/>`,
    `<item id="titlepage" href="title_page.xhtml" media-type="application/xhtml+xml"/>`,
    `<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`,
    `<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>`,
  ];
  if (temCapa) {
    manifestItems.push(
      `<item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>`,
      `<item id="cover-image" href="images/cover.jpg" media-type="image/jpeg" properties="cover-image"/>`
    );
  }
  chapters.forEach((c, i) => {
    manifestItems.push(
      `<item id="chap${i + 1}" href="file${String(i + 1).padStart(4, "0")}.xhtml" media-type="application/xhtml+xml"/>`
    );
  });

  const spineItems = [
    temCapa ? `<itemref idref="cover"/>` : "",
    `<itemref idref="titlepage"/>`,
    ...chapters.map((_, i) => `<itemref idref="chap${i + 1}"/>`),
  ].join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="BookId">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${BOOK_TITLE}</dc:title>
    <dc:creator>${BOOK_AUTHOR}</dc:creator>
    <dc:language>${BOOK_LANGUAGE}</dc:language>
    <dc:identifier id="BookId">${BOOK_ID}</dc:identifier>
  </metadata>
  <manifest>
    ${manifestItems.join("\n")}
  </manifest>
  <spine toc="ncx">
    ${spineItems}
  </spine>
</package>`;
  writeFile(path.join(oebpsDir, "content.opf"), xml);
}

// ---------------- CHAPTERS ----------------
function gerarCapitulos(oebpsDir, chapters) {
  chapters.forEach((cap, i) => {
    const fileName = `file${String(i + 1).padStart(4, "0")}.xhtml`;
    const html = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>${cap.title}</title>
<link href="stylesheet.css" rel="stylesheet" type="text/css"/>
</head>
<body class="fff_chapter">
<h3 class="fff_chapter_title">${cap.title}</h3>
${cap.paragraphs.map(p => `<p>${p}</p>`).join("\n")}
</body></html>`;
    writeFile(path.join(oebpsDir, fileName), html);
  });
}

// ---------------- MAIN ----------------
async function main() {
  console.log("📖 Lendo DOCX...");
  const { value } = await mammoth.extractRawText({ path: INPUT_DOCX });

  // divide capítulos por Heading (aqui simplificado: cada linha que começa com "Capítulo")
  const linhas = value.split("\n").map(l => l.trim()).filter(Boolean);
  const chapters = [];
  let atual = null;

  for (const linha of linhas) {
    if (/^Cap[ií]tulo/i.test(linha)) {
      if (atual) chapters.push(atual);
      atual = { title: linha, paragraphs: [] };
    } else if (atual) {
      atual.paragraphs.push(linha);
    }
  }
  if (atual) chapters.push(atual);

  console.log(`📑 Detectados ${chapters.length} capítulos.`);

  // Estrutura EPUB
  const tempDir = path.join(process.cwd(), "epub_temp");
  const metaInfDir = path.join(tempDir, "META-INF");
  const oebpsDir = path.join(tempDir, "OEBPS");
  ensureDir(tempDir);
  ensureDir(metaInfDir);
  ensureDir(oebpsDir);

  gerarMimetype(tempDir);
  gerarContainer(metaInfDir);
  gerarStylesheet(oebpsDir);

  let temCapa = false;
  const imagesDir = path.join(oebpsDir, "images");
  ensureDir(imagesDir);
  if (fs.existsSync(COVER_SOURCE_FILE)) {
    fs.copyFileSync(COVER_SOURCE_FILE, path.join(imagesDir, "cover.jpg"));
    gerarCover(oebpsDir);
    temCapa = true;
  }

  gerarTitlePage(oebpsDir);
  gerarCapitulos(oebpsDir, chapters);
  gerarNav(oebpsDir, chapters);
  gerarTocNcx(oebpsDir, chapters);
  gerarContentOpf(oebpsDir, chapters, temCapa);

  // Compactar
  console.log("📦 Gerando EPUB...");
  const output = fs.createWriteStream(OUTPUT_FILE);
  const archive = archiver("zip", { zlib: { level: 9 } });

  archive.pipe(output);
  archive.file(path.join(tempDir, "mimetype"), { store: true });
  archive.directory(metaInfDir, "META-INF");
  archive.directory(oebpsDir, "OEBPS");

  await archive.finalize();
  console.log(`✅ EPUB gerado: ${OUTPUT_FILE}`);
}

main().catch(err => console.error(err));
