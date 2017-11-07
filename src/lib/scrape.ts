import * as cheerio from 'cheerio';
import * as got from 'got';
import { last } from 'lodash';

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
  url: string;
  summary: string;
  labels: string[];
  path: string;
  notablePerson: {
    name: string;
  };
  events: Event[];
};

function replaceSmartQuotes(str: string) {
  // prettier-ignore
  return str.replace(/[‘’]/g, '\'').replace(/[“”]/g, '"');
}

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

  const events: Event[] = $.root()
    .find('blockquote')
    .toArray()
    .map(e => {
      const $e = $(e);

      $e.find('sup').remove();

      const footnoteId = $e
        .find('a')
        .first()
        .attr('href');
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
        sourceUrl: $.root()
          .find(footnoteId)
          .find('a')
          .attr('href'),
        comments: [
          {
            text: replaceSmartQuotes(sentences.join(' ')),
          },
        ],
        isQuoteByNotablePerson: true,
      };
    });

  return {
    url,
    path: url,
    notablePerson: {
      name,
    },
    summary,
    events,
    labels: [],
  };
}
