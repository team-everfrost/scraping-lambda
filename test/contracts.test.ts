import assert from 'node:assert/strict';
import test from 'node:test';
import { parseRequest } from '../src/contracts.js';

const validRequest = {
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

test('parseRequest accepts the Go v1 contract', () => {
  assert.deepEqual(parseRequest(JSON.stringify(validRequest)), validRequest);
});

test('parseRequest rejects a legacy unversioned message', () => {
  assert.throws(() => parseRequest(JSON.stringify({ documentId: 1 })));
});
