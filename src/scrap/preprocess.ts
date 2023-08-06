const urlPolicy = [
  {
    origin: 'blog.naver.com',
    find: 'blog.naver.com',
    replace: 'm.blog.naver.com',
    policy: 'article-extractor', // article-extractor, puppeteer
  },
];

export const preprocess = async (url: string) => {
  // url 정책에 따라서 url 변경
  const policy = urlPolicy.find((policy) => url.includes(policy.origin));
  if (policy?.find && policy?.replace && !url.includes(policy.replace)) {
    url = url.replace(policy.find, policy.replace);
  }
  return {
    url,
    policy: policy?.policy || 'article-extractor',
  };
};
