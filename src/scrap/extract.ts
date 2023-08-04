import { extract, extractFromHtml } from '@extractus/article-extractor';

export const extractUrl = async (url: string) => {
  const article = await extract(url);
  return article;
};

export const extractHtml = async (html: string) => {
  const article = await extractFromHtml(html);
  return article;
};
