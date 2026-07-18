import { createHash } from 'node:crypto';
import chromium from '@sparticuz/chromium';
import puppeteer, { type HTTPRequest } from 'puppeteer-core';
import { NetworkPolicy } from './network-policy.js';

const maxHTMLBytes = 12 << 20;
const maxContentBytes = 4 << 20;

export interface Capture {
  title: string;
  content: string;
  html: string;
  contentHash: string;
  extractionMethod: string;
}

export async function captureURL(
  rawURL: string,
  timeoutMilliseconds: number,
): Promise<Capture> {
  const policy = new NetworkPolicy();
  const initialURL = await policy.assertPublicURL(rawURL);
  const browser = await puppeteer.launch({
    args: [...chromium.args, '--disable-dev-shm-usage'],
    defaultViewport: { width: 1440, height: 900 },
    executablePath: await chromium.executablePath(),
    headless: true,
  });
  try {
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(Math.min(timeoutMilliseconds, 60_000));
    page.setDefaultTimeout(Math.min(timeoutMilliseconds, 30_000));
    await page.setRequestInterception(true);
    page.on('request', (request) => void authorizeRequest(request, policy));
    await page.goto(initialURL.toString(), { waitUntil: 'networkidle2' });

    const extracted = await page.evaluate(() => {
      const selectors = location.hostname.endsWith('dcinside.com')
        ? ['.writing_view_box', 'article', 'main', '[role="main"]', 'body']
        : ['article', 'main', '[role="main"]', 'body'];
      const root = selectors
        .map((selector) => document.querySelector(selector))
        .find(Boolean);
      const content = root instanceof HTMLElement ? root.innerText : '';
      const heading = root?.querySelector('h1')?.textContent?.trim();
      return {
        title: heading || document.title.trim(),
        content: content.trim(),
      };
    });
    const html = await page.content();
    if (Buffer.byteLength(html) > maxHTMLBytes)
      throw new Error('rendered HTML is too large');
    if (
      !extracted.content ||
      Buffer.byteLength(extracted.content) > maxContentBytes
    ) {
      throw new Error(
        extracted.content
          ? 'extracted content is too large'
          : 'no readable content found',
      );
    }
    return {
      title: extracted.title.slice(0, 500),
      content: extracted.content,
      html,
      contentHash: createHash('sha256').update(extracted.content).digest('hex'),
      extractionMethod: 'chromium-inner-text-v2',
    };
  } finally {
    await browser.close();
  }
}

async function authorizeRequest(
  request: HTTPRequest,
  policy: NetworkPolicy,
): Promise<void> {
  const url = request.url();
  if (
    url.startsWith('data:') ||
    url.startsWith('blob:') ||
    url === 'about:blank'
  ) {
    await request.continue();
    return;
  }
  if (['font', 'media'].includes(request.resourceType())) {
    await request.abort('blockedbyclient');
    return;
  }
  try {
    await policy.assertPublicURL(url);
    await request.continue();
  } catch {
    await request.abort('blockedbyclient');
  }
}
