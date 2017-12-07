import * as got from 'got';
import * as createFuzzySet from 'fuzzyset.js';
import { WIKIPEDIA_API_ENDPOINT } from './constants';

type ExtractFirstRelevantPageImageOptions = {
  pageId: number;
  title: string;
};

export async function extractFirstRelevantPageImage({
  pageId,
  title,
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

  const images = body.parse.images.filter(
    name => /\.jpe?g|png$/i.test(name) === false,
  );

  const set = createFuzzySet(images);

  const fuzzyMatches = set.get(title);
  if (fuzzyMatches && fuzzyMatches[0][0] > 0.85) {
    return fuzzyMatches[0][1];
  }

  return images[0] || undefined;
}
