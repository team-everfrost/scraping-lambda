import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import type { Config } from './config.js';
import type {
  Envelope,
  ScrapeRequestData,
  ScrapeResultData,
} from './contracts.js';
import type { Capture } from './scrape.js';

export interface ArtifactKeys {
  rawArtifactKey: string;
  contentArtifactKey: string;
  fileSize: number;
}

export class AWSGateway {
  private readonly s3: S3Client;
  private readonly sqs: SQSClient;

  constructor(private readonly config: Config) {
    const common = {
      region: config.region,
      ...(config.endpoint ? { endpoint: config.endpoint } : {}),
    };
    this.s3 = new S3Client({
      ...common,
      forcePathStyle: Boolean(config.endpoint),
    });
    this.sqs = new SQSClient(common);
  }

  async store(
    request: Envelope<ScrapeRequestData>,
    capture: Capture,
  ): Promise<ArtifactKeys> {
    const prefix = `scrapes/${request.data.documentId}/v${request.data.documentVersion}/${request.data.jobId}`;
    const rawArtifactKey = `${prefix}/page.html`;
    const contentArtifactKey = `${prefix}/content.txt`;
    const html = Buffer.from(capture.html);
    const content = Buffer.from(capture.content);
    await Promise.all([
      this.s3.send(
        new PutObjectCommand({
          Bucket: this.config.artifactBucket,
          Key: rawArtifactKey,
          Body: html,
          ContentType: 'text/html; charset=utf-8',
        }),
      ),
      this.s3.send(
        new PutObjectCommand({
          Bucket: this.config.artifactBucket,
          Key: contentArtifactKey,
          Body: content,
          ContentType: 'text/plain; charset=utf-8',
        }),
      ),
    ]);
    return {
      rawArtifactKey,
      contentArtifactKey,
      fileSize: html.length + content.length,
    };
  }

  async publish(event: Envelope<ScrapeResultData>): Promise<void> {
    await this.sqs.send(
      new SendMessageCommand({
        QueueUrl: this.config.resultQueueURL,
        MessageBody: JSON.stringify(event),
      }),
    );
  }
}
