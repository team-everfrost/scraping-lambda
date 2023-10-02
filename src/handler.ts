import fs from 'fs';
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

    // DB에서 Docid를 통해 가져오기
    const doc = await findDoc(documentId);
    // 중복 처리 방지
    if (
      doc?.status !== Status.SCRAPE_PENDING &&
      doc?.status !== Status.SCRAPE_REJECTED
    )
      continue;

    // 해당 Doc의 상태를 처리중으로 변경
    await changeDocStatus(documentId, Status.SCRAPE_PROCESSING);

    try {
      // 스크랩
      let article = await extractUrl(doc.url, doc.doc_id);

      // 후처리
      article = await postprocess(article, doc.doc_id);

      // DB 저장
      await updateContent(
        documentId,
        article.title,
        article.image,
        article.content,
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

  // scrap.html 파일 삭제
  if (fs.existsSync('scrap.html')) {
    fs.unlinkSync('scrap.html');
  }

  await client.clean();
  await client.end();
};
