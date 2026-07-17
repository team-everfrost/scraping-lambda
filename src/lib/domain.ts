export const IMAGE_BASE_URL = 'https://image.remak.abys.dev';
export const THUMBNAIL_BASE_URL = 'https://thumbnail.remak.abys.dev';

const SUPPORTED_IMAGE_HOSTNAMES = new Set([
  'image.remak.abys.dev',
  'image.remak.io',
]);

export const getImageS3Key = (value: string): string | null => {
  try {
    const url = new URL(value);

    if (
      url.protocol !== 'https:' ||
      !SUPPORTED_IMAGE_HOSTNAMES.has(url.hostname)
    ) {
      return null;
    }

    return url.pathname.replace(/^\/+/, '') || null;
  } catch {
    return null;
  }
};

// 신규 URL과 DB/HTML에 남아 있을 수 있는 구 URL을 모두 인식합니다.
export const REMAK_IMAGE_URL_PATTERN =
  /https:\/\/image\.remak\.(?:abys\.dev|io)\/[\w-]+\/[\w-]+(?:\.[a-zA-Z0-9]+)?/g;
