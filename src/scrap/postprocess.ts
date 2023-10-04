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

  //TODO 썸네일 URL 교체 -> postprocess에서?
  //썸네일 파일 확장자 추출에 문제 있어 비활성화

  await thumbnailToS3(article.image, docId);
  article.image = `https://thumbnail.remak.io/${docId}`;

  return result;
};

const thumbnailToS3 = async (imageUrl: string, s3Key: string) => {
  const response = await fetchWithRetry(imageUrl);
  const contentType = response.headers['content-type'];
  const imageBuffer = Buffer.from(response.data, 'binary');

  await uploadThumbnailToS3(imageBuffer, contentType, s3Key);
};
