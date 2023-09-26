import { ArticleData } from '@extractus/article-extractor';
import { fetchWithRetry } from '../lib/axios';
import { uploadThumbnailToS3 } from '../lib/s3';

const urlPolicy = [
  // {
  //   origin: 'blog.naver.com',
  //   find: 'type=w80_blur',
  //   replace: 'type=w800',
  // },
];

export const postprocess = async (article: ArticleData, docId: string) => {
  // 수정된 article
  const result = article;

  // 정책에 따라서 본문 변경
  const policy = urlPolicy.find((policy) =>
    article.url.includes(policy.origin),
  );
  if (
    policy?.find &&
    policy?.replace &&
    article.content.includes(policy.find)
  ) {
    // 일치하는 모든 문자열 변경
    const regex = new RegExp(policy.find, 'g');
    result.content = article.content.replace(regex, policy.replace);
  }

  //TODO 썸네일 URL 교체 -> postprocess에서?
  const thumbnailExtension = article.image.split('.').pop() || '';
  await thumbnailToS3(
    article.image,
    docId + (thumbnailExtension ? `.${thumbnailExtension}` : ''),
  );
  article.image =
    `https://thumbnail.remak.io/${docId}` +
    (thumbnailExtension ? `.${thumbnailExtension}` : '');

  return result;
};

const thumbnailToS3 = async (imageUrl: string, s3Key: string) => {
  const response = await fetchWithRetry(imageUrl);
  const contentType = response.headers['content-type'];
  const imageBuffer = Buffer.from(response.data, 'binary');

  await uploadThumbnailToS3(imageBuffer, contentType, s3Key);
};
