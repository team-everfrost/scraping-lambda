import assert from 'node:assert/strict';
import test from 'node:test';
import type { Context, SQSEvent, SQSRecord } from 'aws-lambda';
import type { Config } from '../src/config.js';
import { createHandler, type Dependencies } from '../src/handler.js';

const request = {
  schemaVersion: '1.0',
  eventId: '019b0000-0000-7000-8000-000000000001',
  eventType: 'document.scrape.requested.v1',
  traceId: 'trace-test',
  occurredAt: '2026-07-19T00:00:00Z',
  data: {
    jobId: '019b0000-0000-7000-8000-000000000002',
    documentId: '019b0000-0000-7000-8000-000000000003',
    documentVersion: 1,
    url: 'https://example.com',
  },
};

const config: Config = {
  region: 'ap-northeast-2',
  artifactBucket: 'remak-artifacts',
  resultQueueURL: 'http://localhost:4566/result',
  maxAttempts: 3,
};

const context = { getRemainingTimeInMillis: () => 180_000 } as Context;

test('successful record publishes a completed result', async () => {
  const published: unknown[] = [];
  const dependencies: Dependencies = {
    config,
    capture: async () => ({
      title: 'Example',
      content: 'body',
      html: '<body>body</body>',
      contentHash: 'hash',
      extractionMethod: 'test',
    }),
    store: async () => ({
      rawArtifactKey: 'raw',
      contentArtifactKey: 'content',
      fileSize: 10,
    }),
    publish: async (event) => void published.push(event),
  };
  const result = await createHandler(dependencies)(event(1), context);
  assert.deepEqual(result.batchItemFailures, []);
  const completed = published[0] as {
    eventType: string;
    data: Record<string, unknown>;
  };
  assert.equal(completed.eventType, 'document.scrape.completed.v1');
  assert.equal('url' in completed.data, false);
});

test('retryable record is returned as a partial batch failure', async () => {
  let publishCount = 0;
  const result = await createHandler(failingDependencies(() => publishCount++))(
    event(1),
    context,
  );
  assert.deepEqual(result.batchItemFailures, [{ itemIdentifier: 'message-1' }]);
  assert.equal(publishCount, 0);
});

test('last attempt publishes a failed result and acknowledges the record', async () => {
  const published: unknown[] = [];
  const result = await createHandler(
    failingDependencies((value) => void published.push(value)),
  )(event(3), context);
  assert.deepEqual(result.batchItemFailures, []);
  assert.equal(
    (published[0] as { eventType: string }).eventType,
    'document.scrape.failed.v1',
  );
});

function failingDependencies(
  onPublish: (value: unknown) => void,
): Dependencies {
  return {
    config,
    capture: async () => {
      throw new Error('navigation timeout');
    },
    store: async () => ({
      rawArtifactKey: '',
      contentArtifactKey: '',
      fileSize: 0,
    }),
    publish: async (value) => onPublish(value),
  };
}

function event(receiveCount: number): SQSEvent {
  return {
    Records: [
      {
        messageId: 'message-1',
        body: JSON.stringify(request),
        attributes: { ApproximateReceiveCount: String(receiveCount) },
      } as SQSRecord,
    ],
  };
}
