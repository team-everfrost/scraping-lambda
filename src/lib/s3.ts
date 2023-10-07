import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

// AWS 설정
const s3Client = new S3Client({
  region: 'ap-northeast-2',
});

const uploadToS3 = async (
  base64Image: string,
  s3Key: string,
  bucketName: string = 'remak-image',
) => {
  const [, content] = base64Image.split(',');
  const buffer = Buffer.from(content, 'base64');

  const fileType = await import('file-type');
  const result = await fileType.fileTypeFromBuffer(buffer);

  const contentType = result?.mime ?? 'image/jpeg';

  const params = {
    Bucket: bucketName,
    Key: s3Key,
    Body: buffer,
    ContentType: contentType,
  };

  const uploader = new Upload({
    client: s3Client,
    params: params,
  });

  await uploader.done();
};

export const uploadAllImages = async (imageMap: Record<string, string>) => {
  const uploadPromises = [];

  for (const url in imageMap) {
    // image.remak.io 뒷부분을 한번에 추출
    const matches = url.match(/https:\/\/image.remak.io\/(.*)/);

    if (matches && matches.length > 1) {
      const s3Key = matches[1];
      uploadPromises.push(uploadToS3(imageMap[url], s3Key));
    } else {
      console.error(`Invalid URL format: ${url}`);
    }
  }

  await Promise.all(uploadPromises);
};

export const deleteAllImagesForDocument = async (documentUUID: string) => {
  const BUCKET_NAME = 'remak-image';

  // 1. 해당 documentUUID에 해당하는 모든 객체 목록을 가져옵니다.
  const listCommand = new ListObjectsV2Command({
    Bucket: BUCKET_NAME,
    Prefix: documentUUID + '/',
  });

  const listResponse = await s3Client.send(listCommand);
  if (!listResponse.Contents) {
    console.log('No images to delete.');
    return;
  }

  // 2. 가져온 객체 목록을 기반으로 각 객체를 삭제합니다.
  const deleteParams = {
    Bucket: BUCKET_NAME,
    Delete: {
      Objects: listResponse.Contents.map((item) => ({ Key: item.Key! })),
    },
  };

  await s3Client.send(new DeleteObjectsCommand(deleteParams));
  console.log('Deleted all images.');
};

export const uploadThumbnailToS3 = async (
  imageBuffer: Buffer,
  contentType: string,
  s3Key: string,
  bucketName: string = 'remak-thumbnails',
) => {
  const params = {
    Bucket: bucketName,
    Key: s3Key,
    Body: imageBuffer,
    ContentType: contentType,
  };

  return s3Client.send(new PutObjectCommand(params));
};
