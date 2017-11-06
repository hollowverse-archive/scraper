import * as cheerio from 'cheerio';
import * as got from 'got';

type Options = {
  url: string;
};

type Comment = {
  text: string;
};

type ScrapeResult = {
  url: string;
  summary: string;
  labels: string[];
  path: string;
  notablePerson: {
    name: string;
  };
  events: Array<{
    quote: string;
    sourceUrl: string;
    isQuoteByNotablePerson: string;
    comments: Comment[];
  }>;
};

export async function scrapePage({ url }: Options): Promise<ScrapeResult> {
  const response = await got(url, {
    headers: {
      Accept: 'text/html',
    },
  });
  const $ = cheerio.load(response.body);

  const summary = $.root()
    .find('.hollowverse-summary p')
    .map((_, e) => $(e).text())
    .toArray()
    .join('\n');

  const name = $.root()
    .find('.header-image h1')
    .text()
    .replace('The religion and political views of', '')
    .trim();

  return {
    url,
    path: url,
    notablePerson: {
      name,
    },
    summary,
    events: [],
    labels: [],
  };
}
