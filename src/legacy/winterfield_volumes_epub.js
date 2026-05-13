import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import archiver from "archiver";
import { v4 as uuidv4 } from "uuid";

// ================= CONFIG =================
const OUTPUT_FILE = "winter_field_ES.epub";
const BOOK_TITLE = "Winter Field";
const BOOK_AUTHOR = "straewgibl";
const BOOK_LANGUAGE = "pt-BR";
const BOOK_ID = uuidv4();

const TEMP = "./epub_temp";
const OEBPS = path.join(TEMP, "OEBPS");
const META = path.join(TEMP, "META-INF");
const COVER = "./cover2.jpg";

// Delay MUITO SEGURO: 2s a 5s
const MIN_DELAY = 2000;
const MAX_DELAY = 5000;

// Seletores Blogger
const TITLE_SELECTOR = 'h2 span';
const CONTENT_SELECTOR = 'h2[dir="ltr"] ~ p';

// ================= AMOSTRAGEM =================
const VOLUMES = [
  {
    title: "Volume 1",
    urls: [
      "https://straewgibl.blogspot.com/2026/01/capitulo-1-winter-field.html",
      "https://straewgibl.blogspot.com/2026/01/capitulo-2-winter-field.html",
      "https://straewgibl.blogspot.com/2026/01/capitulo-3-winter-field.html",
      "https://straewgibl.blogspot.com/2026/01/capitulo-4-winter-field.html",
    ],
  },
  {
    title: "Volume 2",
    urls: [
      "https://straewgibl.blogspot.com/2026/01/capitulo-5-winter-field.html",
      "https://straewgibl.blogspot.com/2026/01/capitulo-6-winter-field.html",
      "https://straewgibl.blogspot.com/2026/01/capitulo-7-winter-field.html",
      "https://straewgibl.blogspot.com/2026/01/capitulo-8-winter-field.html",
    ],
  },
  {
    title: "Volume 3",
    urls: [
      "https://straewgibl.blogspot.com/2026/01/capitulo-9-winter-field.html",
      "https://straewgibl.blogspot.com/2026/01/capitulo-10-winter-field.html",
      "https://straewgibl.blogspot.com/2026/01/capitulo-11-winter-field.html",
      "https://straewgibl.blogspot.com/2026/01/capitulo-12-winter-field.html",
    ],
  },
  {
    title: "Volume 4",
    urls: [
      "https://straewgibl.blogspot.com/2026/01/capitulo-13-winter-field.html",
      "https://straewgibl.blogspot.com/2026/01/capitulo-14-winter-field.html",
      "https://straewgibl.blogspot.com/2026/01/capitulo-15-winter-field.html",
      "https://straewgibl.blogspot.com/2026/01/capitulo-16-winter-field.html",
      "https://straewgibl.blogspot.com/2026/01/capitulo-17-winter-field.html",
    ],
  },
  {
    title: "Volume 5",
    urls: [
      "https://straewgibl.blogspot.com/2026/01/capitulo-18-winter-field.html",
      "https://straewgibl.blogspot.com/2026/01/capitulo-19-winter-field.html",
      "https://straewgibl.blogspot.com/2026/01/capitulo-20-winter-field.html",
      "https://straewgibl.blogspot.com/2026/01/capitulo-21-winter-field.html",
    ],
  },
  {
    title: "Extras Volume 6",
    urls: [
      "https://straewgibl.blogspot.com/2026/01/historia-paralela-capitulo-1-winter.html",
      "https://straewgibl.blogspot.com/2026/01/historia-paralela-capitulo-2-winter.html",
      "https://straewgibl.blogspot.com/2026/01/historia-paralela-capitulo-3-winter.html",
    ],
  },
  {
    title: "Extras Volume 7",
    urls: [
      "https://straewgibl.blogspot.com/2026/03/historia-paralela-2-capitulo-1-winter.html",
      "https://straewgibl.blogspot.com/2026/03/historia-paralela-2-capitulo-2-winter.html",
      "https://straewgibl.blogspot.com/2026/03/historia-paralela-2-capitulo-3-winter.html",
      "https://straewgibl.blogspot.com/2026/03/historia-paralela-2-capitulo-4-winter.html",
      "https://straewgibl.blogspot.com/2026/03/historia-paralela-2-capitulo-5-winter.html",
      "https://straewgibl.blogspot.com/2026/03/historia-paralela-2-capitulo-6-winter.html",
      "https://straewgibl.blogspot.com/2026/03/historia-paralela-2-capitulo-7-winter.html",
      "https://straewgibl.blogspot.com/2026/03/historia-paralela-2-capitulo-8-winter.html",
    ],
  },
];

// ================= HELPERS =================
function ensure(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function cleanDir(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  ensure(dir);
}

function esc(text = "") {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function safeDelay() {
  const time =
    Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY + 1)) + MIN_DELAY;

  console.log(`⏳ Delay muito seguro: ${(time / 1000).toFixed(2)}s`);
  await sleep(time);
}

function escolherTitulo(titles) {
  if (!titles.length) return "Capítulo";

  // Remove títulos de volume do tipo: VOLUMEN 3., VOLUME 3, etc.
  const chapterTitle = titles.find(t =>
    /cap[ií]tulo/i.test(t)
  );

  if (chapterTitle) return chapterTitle;

  // fallback: primeiro título que não seja volume
  const nonVolumeTitle = titles.find(t =>
    !/volumen|volume/i.test(t)
  );

  if (nonVolumeTitle) return nonVolumeTitle;

  return titles[0];
}

// ================= SCRAPING =================
async function getCap(browser, url) {
  const page = await browser.newPage();

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
  );

  await page.goto(url, {
    waitUntil: "networkidle0",
    timeout: 120000,
  });

  await sleep(800);

  let titles = [];

  try {
    titles = await page.$$eval("h2 span", els =>
      els
        .map(e => e.textContent.replace(/\s+/g, " ").trim())
        .filter(Boolean)
    );
  } catch {
    titles = [];
  }

  const title = escolherTitulo(titles);

  let paragraphs = [];

  try {
    paragraphs = await page.$$eval('h2[dir="ltr"] ~ p', els =>
      els
        .map(e =>
          e.textContent
            .replace(/\u00a0/g, " ")
            .replace(/\s+/g, " ")
            .trim()
        )
        .filter(Boolean)
        .filter(p => !/^volumen\s*\d+/i.test(p))
    );
  } catch {
    paragraphs = [];
  }

  await page.close();

  return {
    title,
    titlesFound: titles,
    paragraphs,
    url,
  };
}

// ================= EPUB =================
function write(file, content) {
  fs.writeFileSync(file, content, "utf8");
}

function setupStructure() {
  cleanDir(TEMP);
  ensure(OEBPS);
  ensure(META);
  ensure(path.join(OEBPS, "images"));

  write(path.join(TEMP, "mimetype"), "application/epub+zip");

  write(
    path.join(META, "container.xml"),
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

function writeStyles() {
  write(
    path.join(OEBPS, "style.css"),
    `
body {
  font-family: serif;
  line-height: 1.5;
  margin: 1em;
}

h1, h2 {
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
}

.volume-page h1 {
  margin-top: 40%;
}

.source {
  font-size: 0.75em;
  text-align: center;
  text-indent: 0;
  color: #666;
}
`
  );
}

function writeCover() {
  if (!fs.existsSync(COVER)) {
    console.log("⚠️ cover2.jpg não encontrado. EPUB será gerado sem capa.");
    return false;
  }

  fs.copyFileSync(COVER, path.join(OEBPS, "images", "cover.jpg"));

  write(
    path.join(OEBPS, "cover.xhtml"),
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<title>Capa</title>
<link rel="stylesheet" href="style.css"/>
</head>
<body class="cover">
<img src="images/cover.jpg" alt="Capa"/>
</body>
</html>`
  );

  return true;
}

function writeTitlePage() {
  write(
    path.join(OEBPS, "title_page.xhtml"),
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<title>${esc(BOOK_TITLE)}</title>
<link rel="stylesheet" href="style.css"/>
</head>
<body>
<h1>${esc(BOOK_TITLE)}</h1>
<h2>${esc(BOOK_AUTHOR)}</h2>
</body>
</html>`
  );
}

function writeVolumePage(volumeIndex, volumeTitle) {
  const file = `volume_${String(volumeIndex + 1).padStart(2, "0")}.xhtml`;

  write(
    path.join(OEBPS, file),
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<title>${esc(volumeTitle)}</title>
<link rel="stylesheet" href="style.css"/>
</head>
<body class="volume-page">
<h1>${esc(volumeTitle)}</h1>
</body>
</html>`
  );

  return file;
}

function writeChapter(fileName, cap) {
  write(
    path.join(OEBPS, fileName),
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<title>${esc(cap.title)}</title>
<link rel="stylesheet" href="style.css"/>
<meta name="chapterurl" content="${esc(cap.url)}"/>
</head>
<body>
<h2>${esc(cap.title)}</h2>
<p class="source">${esc(cap.url)}</p>
${cap.paragraphs.map(p => `<p>${esc(p)}</p>`).join("\n")}
</body>
</html>`
  );
}

function writeNav(volumes) {
  const navItems = volumes
    .map(
      volume => `
<li>
  <a href="${volume.file}">${esc(volume.title)}</a>
  <ol>
    ${volume.chapters
      .map(ch => `<li><a href="${ch.file}">${esc(ch.title)}</a></li>`)
      .join("\n")}
  </ol>
</li>`
    )
    .join("\n");

  write(
    path.join(OEBPS, "nav.xhtml"),
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
<title>Índice</title>
<link rel="stylesheet" href="style.css"/>
</head>
<body>
<nav epub:type="toc" id="toc">
<h1>Índice</h1>
<ol>
${navItems}
</ol>
</nav>
</body>
</html>`
  );
}

function writeTocNcx(volumes) {
  let playOrder = 1;

  const navPoints = volumes
    .map((volume, vIndex) => {
      const volumeOrder = playOrder++;

      const chapterPoints = volume.chapters
        .map((ch, cIndex) => {
          const chapterOrder = playOrder++;

          return `
<navPoint id="navPoint-v${vIndex + 1}-c${cIndex + 1}" playOrder="${chapterOrder}">
  <navLabel><text>${esc(ch.title)}</text></navLabel>
  <content src="${ch.file}"/>
</navPoint>`;
        })
        .join("\n");

      return `
<navPoint id="navPoint-v${vIndex + 1}" playOrder="${volumeOrder}">
  <navLabel><text>${esc(volume.title)}</text></navLabel>
  <content src="${volume.file}"/>
  ${chapterPoints}
</navPoint>`;
    })
    .join("\n");

  write(
    path.join(OEBPS, "toc.ncx"),
    `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
<head>
<meta name="dtb:uid" content="${esc(BOOK_ID)}"/>
<meta name="dtb:depth" content="2"/>
<meta name="dtb:totalPageCount" content="0"/>
<meta name="dtb:maxPageNumber" content="0"/>
</head>
<docTitle><text>${esc(BOOK_TITLE)}</text></docTitle>
<navMap>
${navPoints}
</navMap>
</ncx>`
  );
}

function writeOpf(volumes, hasCover) {
  const manifest = [
    `<item id="style" href="style.css" media-type="text/css"/>`,
    `<item id="titlepage" href="title_page.xhtml" media-type="application/xhtml+xml"/>`,
    `<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`,
    `<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>`,
  ];

  if (hasCover) {
    manifest.push(
      `<item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>`
    );
    manifest.push(
      `<item id="coverimg" href="images/cover.jpg" media-type="image/jpeg" properties="cover-image"/>`
    );
  }

  const spine = [];

  if (hasCover) spine.push(`<itemref idref="cover"/>`);

  spine.push(`<itemref idref="titlepage"/>`);

  volumes.forEach((volume, vIndex) => {
    manifest.push(
      `<item id="volume${vIndex + 1}" href="${volume.file}" media-type="application/xhtml+xml"/>`
    );
    spine.push(`<itemref idref="volume${vIndex + 1}"/>`);

    volume.chapters.forEach(ch => {
      manifest.push(
        `<item id="chap${ch.index}" href="${ch.file}" media-type="application/xhtml+xml"/>`
      );
      spine.push(`<itemref idref="chap${ch.index}"/>`);
    });
  });

  write(
    path.join(OEBPS, "content.opf"),
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="BookId">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:title>${esc(BOOK_TITLE)}</dc:title>
<dc:creator>${esc(BOOK_AUTHOR)}</dc:creator>
<dc:language>${esc(BOOK_LANGUAGE)}</dc:language>
<dc:identifier id="BookId">${esc(BOOK_ID)}</dc:identifier>
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

function zipEPUB() {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(OUTPUT_FILE);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", resolve);
    archive.on("error", reject);

    archive.pipe(output);

    archive.file(path.join(TEMP, "mimetype"), {
      name: "mimetype",
      store: true,
    });

    archive.directory(OEBPS, "OEBPS");
    archive.directory(META, "META-INF");

    archive.finalize();
  });
}

// ================= MAIN =================
async function main() {
  setupStructure();
  writeStyles();

  const hasCover = writeCover();
  writeTitlePage();

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const builtVolumes = [];
  let chapterIndex = 1;

  try {
    for (let v = 0; v < VOLUMES.length; v++) {
      const volume = VOLUMES[v];

      console.log(`\n📘 Processando ${volume.title}`);

      const volumeFile = writeVolumePage(v, volume.title);

      const builtVolume = {
        title: volume.title,
        file: volumeFile,
        chapters: [],
      };

      for (const url of volume.urls) {
        console.log(`🔎 Extraindo: ${url}`);

        const cap = await getCap(browser, url);

        console.log(`📌 Títulos encontrados: ${cap.titlesFound.join(" | ")}`);
        console.log(`✅ Título escolhido: ${cap.title}`);
        console.log(`📄 Parágrafos: ${cap.paragraphs.length}`);

        const chapterFile = `chapter_${String(chapterIndex).padStart(4, "0")}.xhtml`;

        writeChapter(chapterFile, cap);

        builtVolume.chapters.push({
          index: chapterIndex,
          title: cap.title,
          file: chapterFile,
          url,
        });

        chapterIndex++;

        await safeDelay();
      }

      builtVolumes.push(builtVolume);
    }
  } finally {
    await browser.close();
  }

  writeNav(builtVolumes);
  writeTocNcx(builtVolumes);
  writeOpf(builtVolumes, hasCover);

  await zipEPUB();

  console.log(`\n✅ EPUB de teste gerado com sucesso: ${path.resolve(OUTPUT_FILE)}`);
}

main().catch(err => {
  console.error("❌ Erro fatal:", err);
  process.exit(1);
});