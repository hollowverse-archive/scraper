import * as got from 'got';
import { WIKIPEDIA_API_ENDPOINT } from './constants';

type IsWikipediaPersonOptions = {
  pageId: number;
  title: string;
};

export async function isWikipediaPerson({
  pageId,
  title,
}: IsWikipediaPersonOptions) {
  const response = await got(WIKIPEDIA_API_ENDPOINT, {
    json: true,
    query: {
      action: 'query',
      titles: title,
      prop: 'templates',
      tltemplates: 'Person',
      tlnamespace: 0,
      format: 'json',
    },
  });

  const body = response.body as {
    query: {
      pages: {
        [pageId: number]: {
          pageid: number;
          title: string;
        };
      };
    };
  };

  return (
    body.query.pages[pageId] !== undefined &&
    body.query.pages[pageId].title === title
  );
}
