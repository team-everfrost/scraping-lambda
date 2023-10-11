import { ArticleData } from '@extractus/article-extractor';
import sharp from 'sharp';
import { fetchWithRetry } from '../lib/axios';
import { uploadThumbnailToS3 } from '../lib/s3';

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
  const imageBuffer = Buffer.from(response.data, 'binary');

  const thumbnail = await createThumbnail(imageBuffer);

  await uploadThumbnailToS3(thumbnail, 'image/webp', s3Key);
};

const createThumbnail = async (buffer) => {
  const originalWidth = (await sharp(buffer).metadata()).width;
  const originalHeight = (await sharp(buffer).metadata()).height;

  const thumbnail = await sharp(buffer)
    .rotate()
    .resize({
      width: 1440 > originalWidth ? originalWidth : 1440,
      height: 1440 > originalHeight ? originalHeight : 1440,
      fit: 'outside',
    })
    .toFormat('webp')
    .toBuffer();

  return thumbnail;
};
