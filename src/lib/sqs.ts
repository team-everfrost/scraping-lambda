import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

const sqsClient = new SQSClient({ region: 'ap-northeast-2' });

export const enqueue = async (documentId: number) => {
  const params = {
    QueueUrl: process.env.SQS_URL,
    MessageBody: JSON.stringify({ documentId }),
  };

  try {
    await sqsClient.send(new SendMessageCommand(params));
  } catch (err) {
    console.error(err);
  }
};
