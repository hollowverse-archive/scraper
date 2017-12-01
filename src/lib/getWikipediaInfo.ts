import { Result } from './scrape';
import * as got from 'got';
import * as createFuzzySet from 'fuzzyset.js';
import { map, find } from 'lodash';

const WIKIPEDIA_API_ENDPOINT = 'https://en.wikipedia.org/w/api.php';

export async function getWikipediaInfo(result: Result) {
  const { body } = await got(WIKIPEDIA_API_ENDPOINT, {
    json: true,
    query: {
      action: 'query',
      generator: 'search',
      gsrsearch: result.name,
      gsrprop: 'snippet',
      prop: 'info',
      inprop: 'url',
      format: 'json',
    },
  });

  const titles = map(body.query.pages, (p: any) => p.title);

  const set = createFuzzySet(titles);
  const [[, closestMatch]] = set.get(result.name);

  const page = find(body.query.pages, (p: any) => p.title === closestMatch);

  if (!page) {
    return {};
  }

  const title: string = page.title;
  const url: string = page.canonicalurl;

  return {
    url,
    title,
  };
}
