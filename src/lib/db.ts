import ServerlessClient from 'serverless-postgres';

export const client = new ServerlessClient({
  connectionString: process.env.DB_URL,
  ssl: true,
  application_name: 'scraping-lambda',
  // debug: true,
  delayMs: 3000,
});

export const enum Status {
  SCRAP_PENDING = 'SCRAP_PENDING',
  SCRAP_PROCESSING = 'SCRAP_PROCESSING',
  SCRAP_REJECTED = 'SCRAP_REJECTED',
  COMPLETED = 'COMPLETED',
}

export const findDoc = async (documentId: number) => {
  const queryResult = await client.query(
    'SELECT title, type, url, content, status, user_id FROM document WHERE id = $1',
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
