import { extractFromHtml } from '@extractus/article-extractor';
import axios from 'axios';
import iconv from 'iconv-lite';
import jschardet from 'jschardet';

const encodeToUtf8 = (buffer: Buffer) => {
  const encoding = jschardet.detect(buffer).encoding;
  return iconv.decode(buffer, encoding);
};

export const extractUrl = async (url: string) => {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    headers: {
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
    },
  });
  const buffer = Buffer.from(response.data, 'binary');

  const html = encodeToUtf8(buffer);
  const article = await extractFromHtml(html);

  return article;
};

export const extractHtml = async (html: string) => {
  const article = await extractFromHtml(html);
  return article;
};
