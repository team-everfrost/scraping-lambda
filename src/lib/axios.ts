import axios, { AxiosResponse } from 'axios';

export const fetchWithRetry = async (
  url: string,
  retries: number = 2,
): Promise<AxiosResponse> => {
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return response;
  } catch (error) {
    if (retries > 0) {
      console.log(`Retrying... (${retries} attempts left)`);
      return fetchWithRetry(url, retries - 1);
    } else {
      throw error; // 모든 재시도가 실패하면 에러를 throw합니다.
    }
  }
};
