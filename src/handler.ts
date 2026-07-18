import type {
  Context,
  SQSBatchResponse,
  SQSEvent,
  SQSRecord,
} from 'aws-lambda';
import { AWSGateway } from './aws.js';
import { loadConfig, type Config } from './config.js';
import {
  parseRequest,
  schemaVersion,
  scrapeCompleted,
  scrapeFailed,
  type Envelope,
  type ScrapeRequestData,
  type ScrapeResultData,
} from './contracts.js';
import { captureURL, type Capture } from './scrape.js';

export interface Dependencies {
  config: Config;
  capture: (url: string, timeoutMilliseconds: number) => Promise<Capture>;
  store: (
    request: Envelope<ScrapeRequestData>,
    capture: Capture,
  ) => Promise<{
    rawArtifactKey: string;
    contentArtifactKey: string;
    fileSize: number;
  }>;
  publish: (event: Envelope<ScrapeResultData>) => Promise<void>;
}

export function createHandler(dependencies: Dependencies) {
  return async (
    event: SQSEvent,
    context: Context,
  ): Promise<SQSBatchResponse> => {
    const batchItemFailures: { itemIdentifier: string }[] = [];
    for (const record of event.Records) {
      try {
        await processRecord(record, context, dependencies);
      } catch (error) {
        console.error(
          JSON.stringify({
            level: 'error',
            message: 'scrape record failed',
            messageId: record.messageId,
            error: errorMessage(error),
          }),
        );
        batchItemFailures.push({ itemIdentifier: record.messageId });
      }
    }
    return { batchItemFailures };
  };
}

async function processRecord(
  record: SQSRecord,
  context: Context,
  dependencies: Dependencies,
): Promise<void> {
  const request = parseRequest(record.body);
  const receiveCount = Number.parseInt(
    record.attributes.ApproximateReceiveCount ?? '1',
    10,
  );
  const timeout = Math.max(
    1_000,
    Math.min(150_000, context.getRemainingTimeInMillis() - 15_000),
  );
  try {
    const capture = await dependencies.capture(request.data.url, timeout);
    const artifacts = await dependencies.store(request, capture);
    await dependencies.publish(
      resultEvent(request, scrapeCompleted, {
        jobId: request.data.jobId,
        documentId: request.data.documentId,
        documentVersion: request.data.documentVersion,
        title: capture.title,
        rawArtifactKey: artifacts.rawArtifactKey,
        contentArtifactKey: artifacts.contentArtifactKey,
        contentHash: capture.contentHash,
        extractionMethod: capture.extractionMethod,
        fileSize: artifacts.fileSize,
      }),
    );
    console.info(
      JSON.stringify({
        level: 'info',
        message: 'scrape completed',
        jobId: request.data.jobId,
        documentId: request.data.documentId,
        version: request.data.documentVersion,
      }),
    );
  } catch (error) {
    if (receiveCount < dependencies.config.maxAttempts) throw error;
    await dependencies.publish(
      resultEvent(request, scrapeFailed, {
        jobId: request.data.jobId,
        documentId: request.data.documentId,
        documentVersion: request.data.documentVersion,
        title: '',
        rawArtifactKey: '',
        contentArtifactKey: '',
        contentHash: '',
        extractionMethod: '',
        fileSize: 0,
        errorCode: classifyError(error),
        errorMessage: errorMessage(error).slice(0, 500),
      }),
    );
    console.warn(
      JSON.stringify({
        level: 'warn',
        message: 'scrape permanently failed',
        jobId: request.data.jobId,
        documentId: request.data.documentId,
        version: request.data.documentVersion,
        receiveCount,
      }),
    );
  }
}

function resultEvent(
  request: Envelope<ScrapeRequestData>,
  eventType: typeof scrapeCompleted | typeof scrapeFailed,
  data: ScrapeResultData,
): Envelope<ScrapeResultData> {
  return {
    schemaVersion,
    eventId: request.eventId,
    eventType,
    traceId: request.traceId,
    occurredAt: new Date().toISOString(),
    data,
  };
}

function classifyError(error: unknown): string {
  const message = errorMessage(error).toLowerCase();
  if (
    message.includes('private') ||
    message.includes('reserved') ||
    message.includes('credential-free')
  )
    return 'url_blocked';
  if (message.includes('timeout') || message.includes('timed out'))
    return 'navigation_timeout';
  if (message.includes('content')) return 'extraction_failed';
  return 'scrape_failed';
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

let defaultHandler: ReturnType<typeof createHandler> | undefined;

export const handler = async (
  event: SQSEvent,
  context: Context,
): Promise<SQSBatchResponse> => {
  if (!defaultHandler) {
    const config = loadConfig();
    const gateway = new AWSGateway(config);
    defaultHandler = createHandler({
      config,
      capture: captureURL,
      store: gateway.store.bind(gateway),
      publish: gateway.publish.bind(gateway),
    });
  }
  return defaultHandler(event, context);
};
