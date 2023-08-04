import { ArticleData, extract } from '@extractus/article-extractor';
import {
  Status,
  changeDocStatus,
  client,
  findDoc,
  updateContent,
} from './lib/db';
import { enqueue } from './lib/sqs';
import { preprocess } from './scrap/preprocess';

export const handler = async (event) => {
  await client.connect();

  for (const record of event.Records) {
    // 파싱이 필요할때만 JSON.parse
    let messageBody = record.body;
    if (typeof record.body === 'string') messageBody = JSON.parse(record.body);
    const documentId = messageBody.documentId;

    // DB에서 Docid를 통해 가져오기
    let doc: any;

    try {
      doc = await findDoc(documentId);
      // 중복 처리 방지
      if (
        doc?.status !== Status.SCRAPE_PENDING &&
        doc?.status !== Status.SCRAPE_REJECTED
      )
        continue;
    } catch (e) {
      console.error(e);
      continue;
    }

    // 해당 Doc의 상태를 처리중으로 변경
    await changeDocStatus(documentId, Status.SCRAPE_PROCESSING);

    try {
      const { url, policy } = await preprocess(doc.url);
      console.log(url, policy);
      let article: ArticleData;
      if (policy === 'article-extractor') article = await extract(url);
      else throw new Error('Not supported policy');
      // DB 저장
      await updateContent(documentId, article.title, article.content);
      // SQS에 임베딩 요청
      await enqueue(documentId);
    } catch (e) {
      console.error(e);
      await changeDocStatus(documentId, Status.SCRAPE_REJECTED);
      continue;
    }

    // DB에 상태 저장
    await changeDocStatus(documentId, Status.EMBED_PENDING);
  }

  await client.clean();
  await client.end();
};
