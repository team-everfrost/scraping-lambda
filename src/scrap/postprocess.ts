import { ArticleData } from '@extractus/article-extractor';

const urlPolicy = [
  {
    origin: 'blog.naver.com',
    find: 'type=w80_blur',
    replace: 'type=w800',
  },
];

export const postprocess = async (article: ArticleData) => {
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

  //TODO: 이미지 가져와서 S3에 업로드 후, 이미지 주소 변경

  return result;
};
