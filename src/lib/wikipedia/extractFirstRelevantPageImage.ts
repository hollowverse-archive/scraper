import * as got from 'got';
import { WIKIPEDIA_API_ENDPOINT } from './constants';

type ExtractFirstRelevantPageImageOptions = {
  pageId: number;
};

export async function extractFirstRelevantPageImage({
  pageId,
}: ExtractFirstRelevantPageImageOptions) {
  const response = await got(WIKIPEDIA_API_ENDPOINT, {
    json: true,
    query: {
      action: 'parse',
      pageid: pageId,
      prop: 'images',
      format: 'json',
    },
  });

  const body = response.body as {
    parse: {
      pageid: number;
      title: string;
      images: string[];
    };
  };

  return (
    body.parse.images.filter(name => /\.jpe?g|png$/i.test(name) === false)[0] ||
    undefined
  );
}
