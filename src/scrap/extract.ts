import { extractFromHtml } from '@extractus/article-extractor';
import chromium from '@sparticuz/chromium';
import { exec as execCb } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { deleteAllImagesForDocument, uploadAllImages } from '../lib/s3';

const exec = promisify(execCb);

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
  const binaryPath = path.join(
    __dirname,
    '..',
    '..',
    'node_modules',
    '.bin',
    'single-file',
  );

  let chromiumPath = '';
  if (process.platform === 'darwin') {
    // 맥에선 안되서 brew install chromium --no-quarantine으로 설치
    chromiumPath = '/Applications/Chromium.app/Contents/MacOS/Chromium';
  } else {
    chromiumPath = await chromium.executablePath();
  }

  await exec(
    `${binaryPath} "${url}" --output scrap.html ` +
      `--filename-conflict-action=overwrite ` +
      // `--browser-width=1920 --browser-height=1080 ` +
      // `--browser-args="${chromium.args}" ` +
      `--browser-executable-path="${chromiumPath}" ` +
      `--http-header="Accept-Language: ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7" ` +
      `--user-agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36"`,
  );

  // TODO: HTML 파일을 S3에 업로드합니다.

  const { imageMap, updatedHTMLContent: html } = extractBase64FromHTML(
    'scrap.html',
    doc_id,
  );

  // TODO: html 프리프로세싱, 포스트프로세싱
  //extractor에 transtormation 함수 주입 부분

  const article = await extractFromHtml(html, url, {
    contentLengthThreshold: 0,
  });

  // 본문에 있는 remak URL만 추출. 예: https://image.remak.io/xxxx/xxxx.xxx
  const urlPattern = /https:\/\/image\.remak\.io\/[\w-]+\/[\w-]+\.\w+/g;
  const urls = article.content.match(urlPattern);

  // 추출된 URL만 포함된 ImageMap을 생성합니다.
  const filteredImageMap = urls
    ? urls.reduce((acc: ImageMap, url: string) => {
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
