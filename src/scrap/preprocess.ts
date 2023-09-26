const urlPolicy = [
  {
    origin: 'bbs.ruliweb.com',
    find: 'blog.naver.com',
    replace: 'm.blog.naver.com',
  },
];

export const preprocess = async (html: string) => {
  // url 정책에 따라서 html 변경

  return html;
};
