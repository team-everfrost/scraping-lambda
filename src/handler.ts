import {
  Status,
  changeDocStatus,
  client,
  findDoc,
  updateContent,
} from './lib/db';
import { enqueue } from './lib/sqs';
import { extractUrl } from './scrap/extract';
import { postprocess } from './scrap/postprocess';

export const handler = async (event) => {
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

    // 실행시간 210초 후 실패처리후 throw
    setTimeout(async () => {
      await changeDocStatus(documentId, Status.SCRAPE_REJECTED);
      throw new Error('Timeout');
    }, 210000);

    try {
      // 스크랩
      console.log('Scraping:', doc.url);
      let { article, totalSize } = await extractUrl(doc.url, doc.doc_id);

      // 후처리
      article = await postprocess(article, doc.doc_id);

      // DB 저장
      await updateContent(
        documentId,
        article.title,
        article.image, // thumbnail_url
        article.content,
        totalSize, // file_size
      );
      // SQS에 임베딩 요청
      await enqueue(documentId);
    } catch (e) {
      await changeDocStatus(documentId, Status.SCRAPE_REJECTED);
      throw e;
    }

    // DB에 상태 저장
    await changeDocStatus(documentId, Status.EMBED_PENDING);
  }

  await client.clean();
  await client.end();
};
