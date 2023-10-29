import ServerlessClient from 'serverless-postgres';

export const client = new ServerlessClient({
  connectionString: process.env.DB_URL,
  ssl: true,
  application_name: 'scraping-lambda',
  // debug: true,
  delayMs: 3000,
});

export const enum Status {
  SCRAPE_PENDING = 'SCRAPE_PENDING',
  SCRAPE_PROCESSING = 'SCRAPE_PROCESSING',
  SCRAPE_REJECTED = 'SCRAPE_REJECTED',
  EMBED_PENDING = 'EMBED_PENDING',
}

export const findDocWithRetry = async (documentId: number) => {
  // 5번의 backoff 재시도 후 실패시 throw

  let sleep = 0;

  for (let i = 0; i < 5; i++) {
    const doc = await findDoc(documentId);
    if (doc) return doc;

    // 1초와 기존 sleep * 3 사이의 랜덤한 시간만큼 대기
    sleep = Math.floor(Math.random() * (sleep * 3 - 1000 + 1)) + 1000;

    console.log('Document not found. Retry after:', sleep, 'ms');

    await new Promise((resolve) => setTimeout(resolve, sleep));
  }

  throw new Error('Document not found');
};

const findDoc = async (documentId: number) => {
  const queryResult = await client.query(
    'SELECT title, type, url, content, status, doc_id, user_id FROM document WHERE id = $1',
    [documentId],
  );
  return queryResult.rows[0];
};

export const changeDocStatus = async (documentId: number, status: Status) => {
  await client.query('UPDATE document SET status = $1 WHERE id = $2', [
    status,
    documentId,
  ]);
};

export const updateContent = async (
  documentId: number,
  title: string,
  thumbnail_url: string,
  content: string,
  totalSize: bigint,
) => {
  await client.query(
    'UPDATE document SET title = $1, thumbnail_url = $2, content = $3, file_size = $4 WHERE id = $5',
    [title, thumbnail_url, content, totalSize, documentId],
  );
};
