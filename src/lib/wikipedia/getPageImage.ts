import * as got from 'got';
import { WIKIPEDIA_API_ENDPOINT } from './constants';

type GetPageImageOptions = {
  pageId: number;
};

export async function getPageImage({ pageId }: GetPageImageOptions) {
  const response = await got(WIKIPEDIA_API_ENDPOINT, {
    json: true,
    query: {
      action: 'query',
      pageids: pageId,
      prop: 'pageimages',
      format: 'json',
    },
  });

  const body = response.body as {
    query: {
      pages: {
        [pageId: number]: {
          title: string;
          pageid: number;
          pageimage?: string;
        };
      };
    };
  };

  const page = body.query.pages[pageId];
  if (page) {
    return page.pageimage;
  }

  return undefined;
}
