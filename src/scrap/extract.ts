import { extractFromHtml } from '@extractus/article-extractor';
import chromium from '@sparticuz/chromium';
import crypto from 'crypto';
import fs from 'fs';
import * as api from 'single-file-cli';
import { deleteAllImagesForDocument, uploadAllImages } from '../lib/s3';

interface ImageMap {
  [key: string]: string;
}

export const extractBase64FromHTML = (htmlFilePath: string, doc_id: string) => {
  const htmlContent = fs.readFileSync(htmlFilePath, 'utf-8');

  const imageMap: ImageMap = {};

  // base64 이미지 패턴을 찾습니다.
  const base64Pattern = /data:image\/\w+;base64,([a-zA-Z0-9+/=]+)/g;

  let match;
  let updatedHTMLContent = htmlContent;

  while ((match = base64Pattern.exec(htmlContent))) {
    const base64String = match[0];

    // 파일 확장자를 추출합니다.
    const extension = getExtensionFromBase64Format(base64String);

    const temporaryUrl =
      generateUrl(doc_id) + (extension ? `.${extension}` : '');
    imageMap[temporaryUrl] = base64String;

    // 이미지의 base64를 URL로 교체합니다.
    updatedHTMLContent = updatedHTMLContent.replace(base64String, temporaryUrl);
  }

  return { imageMap, updatedHTMLContent };
};

const generateUrl = (doc_id: string): string => {
  // 임의의 UUID값을 생성하여 URL을 생성합니다.
  const uuid = crypto.randomUUID();
  return `https://image.remak.io/${doc_id}/${uuid}`;
};

const getExtensionFromBase64Format = (format: string): string | null => {
  const match = format.match(/data:image\/([a-zA-Z0-9-+]+);base64/);

  if (!match || match.length < 2) {
    return null;
  }

  // 예외적인 MIME 타입 처리 (예: 'svg+xml'의 경우 확장자는 'svg')
  switch (match[1]) {
    case 'jpeg':
      return 'jpg'; // 일부 사람들은 'jpeg' 확장자도 사용하지만 'jpg'가 일반적입니다.
    case 'svg+xml':
      return 'svg';
    default:
      return match[1];
  }
};

export const extractUrl = async (url: string, doc_id: string) => {
  let browserExecutablePath = '',
    output = 'scrap.html',
    browserArgs = '';
  if (process.platform === 'darwin') {
    // 맥에선 안되서 brew install chromium --no-quarantine으로 설치
    browserExecutablePath =
      '/Applications/Chromium.app/Contents/MacOS/Chromium';
  } else {
    browserExecutablePath = await chromium.executablePath();
    output = '/tmp/scrap.html';
    browserArgs = JSON.stringify([
      '--disable-domain-reliability',
      '--disable-print-preview',
      '--disable-speech-api',
      '--disk-cache-size=33554432',
      '--mute-audio',
      '--no-default-browser-check',
      // '--no-pings', //single-file-cli에서 기본으로 포함됨
      '--single-process',

      '--hide-scrollbars',
      '--ignore-gpu-blocklist',
      '--in-process-gpu',

      '--allow-running-insecure-content',
      '--disable-setuid-sandbox',
      '--disable-site-isolation-trials',
      '--disable-web-security',
      '--no-sandbox',
      '--no-zygote',
    ]);
  }

  const args = {
    browserExecutablePath,
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
    filenameConflictAction: 'overwrite',
    acceptHeaders: {
      font: 'application/font-woff2;q=1.0,application/font-woff;q=0.9,*/*;q=0.8',
      image: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      stylesheet: 'text/css,*/*;q=0.1',
      script: '*/*',
      document:
        'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    backEnd: 'puppeteer',
    blockMixedContent: false,
    browserServer: '',
    browserHeadless: true,
    browserWidth: 1920,
    browserHeight: 1080,
    browserLoadMaxTime: 60000,
    browserWaitDelay: 0,
    browserWaitUntil: 'networkidle0',
    browserWaitUntilFallback: true,
    browserDebug: false,
    browserArgs,
    browserStartMinimized: false,
    browserCookiesFile: '',
    browserIgnoreInsecureCerts: false,
    browserFreezePrototypes: false,
    dumpContent: false,
    filenameTemplate: '{page-title} ({date-iso} {time-locale}).html',
    filenameReplacementCharacter: '_',
    filenameMaxLength: 192,
    filenameMaxLengthUnit: 'bytes',
    replaceEmojisInFilename: false,
    groupDuplicateImages: true,
    maxSizeDuplicateImages: 524288,
    httpProxyServer: '',
    httpProxyUsername: '',
    httpProxyPassword: '',
    includeInfobar: false,
    insertMetaCsp: true,
    loadDeferredImages: true,
    loadDeferredImagesDispatchScrollEvent: false,
    loadDeferredImagesMaxIdleTime: 1500,
    loadDeferredImagesKeepZoomLevel: false,
    loadDeferredImagesBeforeFrames: false,
    maxParallelWorkers: 8,
    maxResourceSizeEnabled: false,
    maxResourceSize: 10,
    moveStylesInHead: false,
    outputDirectory: '',
    removeHiddenElements: true,
    removeUnusedStyles: true,
    removeUnusedFonts: true,
    removeSavedDate: false,
    removeFrames: false,
    blockScripts: true,
    blockAudios: true,
    blockVideos: true,
    removeAlternativeFonts: true,
    removeAlternativeMedias: true,
    removeAlternativeImages: true,
    saveOriginalUrls: false,
    saveRawPage: false,
    webDriverExecutablePath: '',
    userScriptEnabled: true,
    crawlLinks: false,
    crawlInnerLinksOnly: true,
    crawlRemoveUrlFragment: true,
    crawlMaxDepth: 1,
    crawlExternalLinksMaxDepth: 1,
    crawlReplaceUrls: false,
    url,
    output,
    backgroundSave: true,
    crawlReplaceURLs: false,
    crawlRemoveURLFragment: true,
    insertMetaCSP: true,
    saveOriginalURLs: false,
    httpHeaders: {
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    },
    browserCookies: [],
    browserScripts: [],
    browserStylesheets: [],
    crawlRewriteRules: [],
    emulateMediaFeatures: [],
    retrieveLinks: true,

    compressHTML: false,
  };

  const scrapUrls = [url];

  const singlefile = await api.initialize(args);
  await singlefile.capture(scrapUrls);
  await singlefile.finish();

  // TODO: HTML 파일을 S3에 업로드합니다.

  const { imageMap, updatedHTMLContent: html } = extractBase64FromHTML(
    output,
    doc_id,
  );

  // TODO: html 프리프로세싱, 포스트프로세싱
  //extractor에 transtormation 함수 주입 부분

  const article = await extractFromHtml(html, url, {
    contentLengthThreshold: 0,
  });

  // 본문에 있는 remak URL만 추출. 예: https://image.remak.io/xxxx/xxxx.xxx
  const urlPattern = /https:\/\/image\.remak\.io\/[\w-]+\/[\w-]+\.\w+/g;
  const remakUrls = article.content.match(urlPattern);

  // 추출된 URL만 포함된 ImageMap을 생성합니다.
  const filteredImageMap = remakUrls
    ? remakUrls.reduce((acc: ImageMap, url: string) => {
        if (imageMap[url]) {
          acc[url] = imageMap[url];
        }
        return acc;
      }, {})
    : {};

  //이미지 키와 base64 첫 50자를 출력합니다.
  console.log(
    Object.keys(filteredImageMap)
      .map((key) => `${key} : ${filteredImageMap[key].substr(0, 50)}`)
      .join('\n'),
  );

  // 기존 이미지를 S3에서 삭제합니다
  await deleteAllImagesForDocument(doc_id);

  //이미지를 S3에 업로드합니다
  await uploadAllImages(filteredImageMap);

  return article;
};
