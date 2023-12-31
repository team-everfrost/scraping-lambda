import { exec } from 'child_process';
import {
  Status,
  changeDocStatus,
  client,
  findDoc,
  updateContent,
} from './lib/db';
import { enqueue } from './lib/sqs';
import { promiseTimeout } from './lib/timeout';
import { extractFallback, extractUrl } from './scrap/extract';
import { postprocess } from './scrap/postprocess';

export const handler = async (event, context) => {
  await client.connect();

  for (const record of event.Records) {
    const messageBody =
      typeof record.body === 'string' ? JSON.parse(record.body) : record.body;
    const documentId = messageBody.documentId;

    console.log('DocumentId:', documentId);

    // DB에서 Docid를 통해 가져오기
    const doc = await findDoc(documentId);
    // 중복 처리 방지
    if (
      doc?.status !== Status.SCRAPE_PENDING &&
      doc?.status !== Status.SCRAPE_REJECTED
    )
      continue;

    console.log('Before Status:', doc?.status);

    // 해당 Doc의 상태를 처리중으로 변경
    await changeDocStatus(documentId, Status.SCRAPE_PROCESSING);

    // 이전 puppeteer 크로미움 프로파일 삭제
    cleanTmpDirectory();

    try {
      // lambda timeout 10초 전으로 제한시간 설정
      await promiseTimeout(
        context.getRemainingTimeInMillis() - 10000,
        job(doc, documentId),
      );
    } catch (e) {
      console.error('Scrape Failed. Error:', e);
      await changeDocStatus(documentId, Status.SCRAPE_REJECTED);
      throw e;
    }

    console.log('scrape success');

    // DB에 상태 저장
    await changeDocStatus(documentId, Status.EMBED_PENDING);
  }

  await client.clean();
  await client.end();
};

const job = async (doc: any, documentId: number) => {
  // 스크랩
  console.log('Scraping:', doc.url);

  try {
    const { article, totalSize } = await extractUrl(doc.url, doc.doc_id);

    // 후처리
    const updatedArticle = await postprocess(article, doc.doc_id);

    // DB 저장
    await updateContent(
      documentId,
      updatedArticle.title,
      updatedArticle.image, // thumbnail_url
      updatedArticle.content,
      totalSize, // file_size
    );
    // SQS에 임베딩 요청
    await enqueue(documentId);
  } catch (e) {
    console.error('single-file Scrap Failed. Error:', e);
    await changeDocStatus(documentId, Status.SCRAPE_REJECTED);

    console.log('Try extract metadata from url:', doc.url);
    const article = await extractFallback(doc.url);

    // 후처리
    const updatedArticle = await postprocess(article, doc.doc_id);

    // DB 저장
    await updateContent(
      documentId,
      updatedArticle.title,
      updatedArticle.image, // thumbnail_url
      '',
      0n, // file_size
    );

    throw e;
  }
};

const cleanTmpDirectory = () => {
  const command = 'find /tmp -name "puppeteer_dev*" -type d | xargs rm -rf';
  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`cleanTmp exec error: ${error}`);
      return;
    }
    if (stderr) {
      console.error(`cleanTmp stderr: ${stderr}`);
      return;
    }
    console.log(`cleanTmp stdout: ${stdout}`);
  });
};
