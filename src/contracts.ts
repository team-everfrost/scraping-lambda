export const schemaVersion = '1.0' as const;
export const scrapeRequested = 'document.scrape.requested.v1' as const;
export const scrapeCompleted = 'document.scrape.completed.v1' as const;
export const scrapeFailed = 'document.scrape.failed.v1' as const;

export interface Envelope<T> {
  schemaVersion: typeof schemaVersion;
  eventId: string;
  eventType: string;
  traceId: string;
  occurredAt: string;
  data: T;
}

export interface ScrapeRequestData {
  jobId: string;
  documentId: string;
  documentVersion: number;
  url: string;
}

export interface ScrapeResultData {
  jobId: string;
  documentId: string;
  documentVersion: number;
  title: string;
  rawArtifactKey: string;
  contentArtifactKey: string;
  contentHash: string;
  extractionMethod: string;
  fileSize: number;
  errorCode?: string;
  errorMessage?: string;
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseRequest(body: string): Envelope<ScrapeRequestData> {
  const value: unknown = JSON.parse(body);
  if (
    !isRecord(value) ||
    value.schemaVersion !== schemaVersion ||
    value.eventType !== scrapeRequested
  ) {
    throw new Error('unsupported scrape request envelope');
  }
  if (
    !isUUID(value.eventId) ||
    typeof value.traceId !== 'string' ||
    !isRecord(value.data)
  ) {
    throw new Error('invalid scrape request envelope');
  }
  const data = value.data;
  if (
    !isUUID(data.jobId) ||
    !isUUID(data.documentId) ||
    !Number.isInteger(data.documentVersion) ||
    Number(data.documentVersion) <= 0 ||
    typeof data.url !== 'string'
  ) {
    throw new Error('invalid scrape request data');
  }
  return value as unknown as Envelope<ScrapeRequestData>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUUID(value: unknown): value is string {
  return typeof value === 'string' && uuidPattern.test(value);
}
