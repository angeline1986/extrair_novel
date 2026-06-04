import puppeteer from 'puppeteer';

export async function openBrowser() {
  return puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
}

export async function fetchRenderedChapterHtml(browser, url) {
  const page = await browser.newPage();
  try {
    await page.setUserAgent('Mozilla/5.0 EPUB audit chapter extractor');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('#chapterContent p', { timeout: 60000 });
    await new Promise((resolve) => setTimeout(resolve, 500));
    return page.evaluate(() => document.querySelector('#chapterContent')?.outerHTML || '');
  } finally {
    await page.close();
  }
}
