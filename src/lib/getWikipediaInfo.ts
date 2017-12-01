import { Result } from './scrape';
import * as got from 'got';
import * as createFuzzySet from 'fuzzyset.js';
import { map, find } from 'lodash';

const WIKIPEDIA_API_ENDPOINT = 'https://en.wikipedia.org/w/api.php';

type WikipediaInfo = {
  url: string;
  title: string;
  thumbnail: {
    source: string;
    width: number;
    height: number;
  };
};

export async function getWikipediaInfo(
  result: Result,
  thumbnailHeight = 300,
): Promise<Partial<WikipediaInfo>> {
  const urlRequest = got(WIKIPEDIA_API_ENDPOINT, {
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

  const imageRequest = got(WIKIPEDIA_API_ENDPOINT, {
    json: true,
    query: {
      action: 'query',
      titles: result.name,
      prop: 'pageimages',
      pithumbsize: thumbnailHeight,
      format: 'json',
    },
  });

  const urlBody = (await urlRequest).body;

  const titles = map(urlBody.query.pages, (p: any) => p.title);

  const set = createFuzzySet(titles);
  const matches = set.get(result.name);
  if (matches && matches.length > 0) {
    const [[, closestMatch]] = matches;
    const page = find(
      urlBody.query.pages,
      (p: any) => p.title === closestMatch,
    );

    if (!page) {
      return {};
    }

    const title: string = page.title;
    const url: string = page.canonicalurl;

    const imageBody = (await imageRequest).body;
    const thumbnail = imageBody.query.pages[page.pageid].thumbnail;

    return {
      url,
      title,
      thumbnail,
    };
  }

  return {};
}
