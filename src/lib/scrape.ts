import * as cheerio from 'cheerio';
import * as got from 'got';
import { last } from 'lodash';
import { URL } from 'url';
import { replaceSmartQuotes } from './helpers';

type Options = {
  url: string;
};

type EventComment = {
  text: string;
};

type Event = {
  quote: string;
  sourceUrl: string;
  isQuoteByNotablePerson: boolean;
  comments: EventComment[];
};

type ScrapeResult = {
  summary: string;
  labels: string[];
  notablePerson: {
    name: string;
  };
  events: Event[];
};

export async function scrapeHtml(html: string): Promise<ScrapeResult> {
  const $ = cheerio.load(html);

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

  const events: Event[] = $.root()
    .find('blockquote')
    .toArray()
    .map(e => {
      const $e = $(e);

      const footnoteId = $e
        .find('a')
        .first()
        .attr('href');

      const sourceUrl = $.root()
        .find(footnoteId)
        .find('a')
        .attr('href');

      $e.find('sup').remove();

      let comment;

      comment = $e.prev('p');

      if (!comment.text().endsWith(':')) {
        comment = $e.next('p');
      }

      comment.find('sup').remove();

      const sentences = comment
        .text()
        .replace(/([.?!])\s*(?=[A-Z])/g, '$1|')
        .split('|');
      const lastSentence = last(sentences);

      if (lastSentence && lastSentence.endsWith(':')) {
        if (sentences.length > 1) {
          sentences.splice(sentences.length - 1);
        } else {
          sentences[sentences.length - 1] = lastSentence.replace(
            /,([^,])+:$/i,
            '.',
          );
        }
      }

      return {
        quote: replaceSmartQuotes($e.find('p').text()),
        sourceUrl,
        comments: [
          {
            text: replaceSmartQuotes(sentences.join(' ')),
          },
        ],
        isQuoteByNotablePerson: true,
      };
    });

  return {
    notablePerson: {
      name,
    },
    summary,
    events,
    labels: [],
  };
}

export async function scrapePage({ url }: Options) {
  const response = await got(url, {
    headers: {
      Accept: 'text/html',
    },
  });

  return {
    url,
    path: new URL(url).pathname.replace(/\//g, ''),
    ...await scrapeHtml(response.body),
  };
}
