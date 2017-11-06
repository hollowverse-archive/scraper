import * as cheerio from 'cheerio';
import * as got from 'got';

type Options = {
  url: string;
};

export async function scrapePage({ url }: Options) {
  const response = await got(url, {
    headers: {
      Accept: 'text/html',
    },
  });
  const $ = cheerio.load(response.body);

  return {
    url,
    data: '',
  };
}
