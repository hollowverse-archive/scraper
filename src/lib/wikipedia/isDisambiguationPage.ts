import * as got from 'got';
import { WIKIPEDIA_API_ENDPOINT } from './constants';
import { find } from 'lodash';

type IsDisambiguationPageOptions = {
  pageId: number;
};

export async function isDisambiguationPage({
  pageId,
}: IsDisambiguationPageOptions) {
  const response = await got(WIKIPEDIA_API_ENDPOINT, {
    json: true,
    query: {
      action: 'parse',
      pageid: pageId,
      prop: 'categories',
      format: 'json',
    },
  });

  const body = response.body as {
    parse: {
      title: string;
      pageid: number;
      categories: {
        [x: number]: {
          ns: number;
          exists: string;
          ['*']: string;
        };
      };
    };
  };

  const categories = Object.values(body.parse.categories);

  return (
    find(
      categories,
      category => category['*'] === 'All_disambiguation_pages',
    ) !== undefined
  );
}
