import { Result } from './scrape';
import * as got from 'got';
import * as createFuzzySet from 'fuzzyset.js';
import { find } from 'lodash';

const WIKIPEDIA_API_ENDPOINT = 'https://en.wikipedia.org/w/api.php';

export type WikipediaData = {
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
): Promise<Partial<WikipediaData>> {
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

  const urlBody = (await urlRequest).body as {
    query: {
      pages: {
        [pageId: number]: {
          pageid: number;
          title: string;
          canonicalurl: string;
        };
      };
    };
  };

  let page;
  const pages = Object.values(urlBody.query.pages);
  const firstResult = pages[0];
  const set = createFuzzySet(pages.map(p => p.title));
  const matches = set.get(result.name);
  const firstMatch = matches ? matches[0] : undefined;
  if (
    firstResult &&
    matches &&
    // Fuzzy set includes exact match
    matches.map(([, match]) => match).includes(firstResult.title)
  ) {
    page = firstResult;
  } else if (
    // or fuzzy match has a confidence value that is high enough
    firstMatch &&
    firstMatch[0] >= 0.85
  ) {
    const [, closestTitle] = firstMatch;
    page = find(pages, p => p.title === closestTitle);
  }

  if (page === undefined) {
    return {};
  }

  const title = page.title;
  const url = page.canonicalurl;

  const imageRequest = got(WIKIPEDIA_API_ENDPOINT, {
    json: true,
    query: {
      action: 'query',
      titles: page.title,
      prop: 'pageimages',
      pithumbsize: thumbnailHeight,
      format: 'json',
    },
  });

  const imageBody = (await imageRequest).body as {
    query: {
      pages: {
        [pageId: number]:
          | {
              pageid: string;
              title: string;
              thumbnail: {
                source: string;
                width: number;
                height: number;
              };
            }
          | undefined;
      };
    };
  };

  const imageObject =
    imageBody.query.pages[page.pageid] ||
    Object.values(imageBody.query.pages)[0];

  let thumbnail;
  if (imageObject) {
    thumbnail = imageObject.thumbnail;
  }

  return {
    url,
    title,
    thumbnail,
  };
}
