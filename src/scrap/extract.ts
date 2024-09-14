import {
  addTransformations,
  extract,
  extractFromHtml,
  setSanitizeHtmlOptions,
} from '@extractus/article-extractor';
import chromium from '@sparticuz/chromium';
import crypto from 'crypto';
import fs from 'fs';
import * as api from 'single-file-cli';
import { deleteAllImagesForDocument, uploadAllImages } from '../lib/s3';
import { promiseTimeout } from '../lib/timeout';
import { defaultSingleFileArgs, lambdaBrowserArgs } from './args';
import { loadTransformations } from './loadTransformations';

interface ImageMap {
  [key: string]: string;
}

// https://github.com/Sparticuz/chromium/issues/271
chromium.setGraphicsMode = true;
console.log(chromium);

export const extractBase64FromHTML = async (
  htmlFilePath: string,
  doc_id: string,
) => {
  const htmlContent = fs.readFileSync(htmlFilePath, 'utf-8');

  const imageMap: ImageMap = {};

  // base64 이미지 패턴을 찾습니다.
  const base64Pattern =
    /data:(image\/\w+|(application|binary)\/octet-stream);base64,([a-zA-Z0-9+/=]+)/g;

  let match;
  let updatedHTMLContent = htmlContent;

  while ((match = base64Pattern.exec(htmlContent))) {
    const base64String = match[0];

    // 파일 확장자를 추출합니다.
    const extension = await getExtensionFromBase64(base64String);

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

const getExtensionFromBase64 = async (base64Str: string) => {
  const [, content] = base64Str.split(',');
  const buffer = Buffer.from(content, 'base64');

  const fileType = await import('file-type');
  const result = await fileType.fileTypeFromBuffer(buffer);

  return result?.ext ?? null;
};

const singleFile = async (args: object, url: string) => {
  console.log('singleFile started', { url });
  const scrapUrls = [url];
  console.log('scrapUrls:', scrapUrls);

  try {
    console.log('Initializing api');
    const singlefile = await api.initialize(args);
    console.log('API initialized successfully');

    console.log('Starting capture');
    await singlefile.capture(scrapUrls);
    console.log('Capture completed');

    console.log('Finishing singlefile');
    await singlefile.finish();
    console.log('singleFile finished successfully');
  } catch (error) {
    console.error('Error in singleFile:', error);
    throw error; // 에러를 상위로 전파
  }
};

const scrapeJob = async (args: any, url: string) => {
  console.log('scrape start');
  await promiseTimeout(180 * 1000, singleFile(args, url));
  if (!fs.existsSync(args.output)) {
    throw new Error('HTML file not found. scrap failed');
  }
};

export const extractUrl = async (url: string, doc_id: string) => {
  let browserExecutablePath = '',
    output = 'scrap.html',
    browserArgs = '';
  if (process.platform === 'darwin') {
    // 맥에선 안돼서 brew install chromium --no-quarantine으로 설치
    browserExecutablePath =
      '/Applications/Chromium.app/Contents/MacOS/Chromium';
  } else {
    browserExecutablePath = await chromium.executablePath();
    output = `/tmp/${doc_id}-scrap.html`;
    browserArgs = lambdaBrowserArgs;

    console.log('browserExecutablePath:', browserExecutablePath);
    console.log('output:', output);
    console.log('browserArgs:', browserArgs);
  }

  const args = {
    ...defaultSingleFileArgs,
    browserExecutablePath,
    output,
    url,
    browserArgs,
  };

  await scrapeJob(args, url);

  // TODO: 이미지를 갈아치운 HTML 파일을 S3에 업로드합니다?

  // filecheck
  if (!fs.existsSync(output)) {
    throw new Error('HTML file not found. scrap failed');
  }

  const { imageMap, updatedHTMLContent: html } = await extractBase64FromHTML(
    output,
    doc_id,
  );

  //code lang 살려놓도록 설정
  setSanitizeHtmlOptions({
    allowedClasses: {
      code: ['language-*', 'lang-*'],
    },
  });

  //transformtation
  addTransformations(await loadTransformations());

  const article = await extractFromHtml(html, url, {
    contentLengthThreshold: 0,
  });

  // 본문에 있는 remak URL만 추출. 예: https://image.remak.io/xxxx/xxxx.xxx (확장자 없을 수도 있음)
  const urlPattern =
    /https:\/\/image\.remak\.io\/[\w-]+\/[\w-]+(\.[a-zA-Z0-9]+)?/g;
  const remakUrls = article.content.match(urlPattern);

  // 추출된 URL만 포함된 ImageMap을 생성합니다.
  const filteredImageMap: ImageMap = remakUrls
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

  // filteredImageMap의 모든 value(base64)를 바탕으로 파일 크기를 계산합니다.
  const totalSize = BigInt(
    Object.values(filteredImageMap)
      .reduce((acc, base64) => acc + base64.length * 0.75, 0)
      .toFixed(0),
  );
  console.log('Total size:', totalSize);

  return { article, totalSize };
};

export const extractFallback = async (url: string) => {
  const result = await extract(url);

  return result;
};
