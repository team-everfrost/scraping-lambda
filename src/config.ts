export interface Config {
  region: string;
  endpoint?: string;
  artifactBucket: string;
  resultQueueURL: string;
  maxAttempts: number;
}

export function loadConfig(
  environment: NodeJS.ProcessEnv = process.env,
): Config {
  const artifactBucket = required(environment, 'ARTIFACT_BUCKET');
  const resultQueueURL = required(environment, 'SCRAPE_RESULT_QUEUE_URL');
  const maxAttempts = Number.parseInt(
    environment.MAX_SCRAPE_ATTEMPTS ?? '3',
    10,
  );
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10) {
    throw new Error('MAX_SCRAPE_ATTEMPTS must be between 1 and 10');
  }
  const endpoint = environment.AWS_ENDPOINT_URL?.trim();
  return {
    region: environment.AWS_REGION?.trim() || 'ap-northeast-2',
    ...(endpoint ? { endpoint } : {}),
    artifactBucket,
    resultQueueURL,
    maxAttempts,
  };
}

function required(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}
