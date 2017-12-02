import { Result } from './scrape';
import * as got from 'got';
import * as createFuzzySet from 'fuzzyset.js';
import { find } from 'lodash';

const WIKIPEDIA_API_ENDPOINT = 'https://en.wikipedia.org/w/api.php';

type IsWikipediaPersonOptions = {
  pageId: number;
  title: string;
};

async function isWikipediaPerson({ pageId, title }: IsWikipediaPersonOptions) {
  const response = await got(WIKIPEDIA_API_ENDPOINT, {
    json: true,
    query: {
      action: 'query',
      titles: title,
      prop: 'templates',
      tltemplates: 'Person',
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

type GetWikipediaThumbnailOptions = {
  title: string;
  pageId: number;
  thumbnailHeight: number;
};

async function getWikipediaThumbnail({
  title,
  pageId,
  thumbnailHeight,
}: GetWikipediaThumbnailOptions) {
  const response = await got(WIKIPEDIA_API_ENDPOINT, {
    json: true,
    query: {
      action: 'query',
      titles: title,
      prop: 'pageimages',
      piprop: 'thumbnail',
      pithumbsize: thumbnailHeight,
      format: 'json',
    },
  });

  const body = response.body as {
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

  const imageObject = body.query.pages[pageId];

  return imageObject ? imageObject.thumbnail : undefined;
}

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
  const pageId = page.pageid;

  const isPerson = await isWikipediaPerson({ title, pageId });
  if (!isPerson) {
    return {};
  }

  const url = page.canonicalurl;
  const thumbnail = await getWikipediaThumbnail({
    title,
    thumbnailHeight,
    pageId,
  });

  return {
    url,
    title,
    thumbnail,
  };
}
