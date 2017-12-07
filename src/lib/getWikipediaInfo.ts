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

async function isDisambiguationPage({ pageId }: { pageId: number }) {
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

export type WikipediaData = {
  url: string;
  title: string;
  thumbnail: {
    source: string;
    width: number;
    height: number;
  };
  isDisambiguation: boolean;
};

export type GetWikipediaInfoOptions = {
  result: Result;
  thumbnailHeight?: number;
  /**
   * Canonical URL of the actual page to use in case the API
   * returns a disambiguation page
   */
  override?: string;
};

export async function getWikipediaInfo({
  result,
  thumbnailHeight = 300,
  override,
}: GetWikipediaInfoOptions): Promise<Partial<WikipediaData>> {
  const response = await got(WIKIPEDIA_API_ENDPOINT, {
    json: true,
    query: {
      action: 'query',
      generator: 'search',
      gsrsearch: override
        ? decodeURI(override)
            .replace('https://en.wikipedia.org/wiki/', '')
            .replace(/_/g, ' ')
        : result.name,
      gsrprop: 'snippet',
      prop: 'info',
      inprop: 'url',
      format: 'json',
    },
  });

  const body = response.body as {
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
  const pages = Object.values(body.query.pages);
  if (typeof override === 'string') {
    page = find(pages, p => p.canonicalurl === override);
  } else {
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
  }

  if (page === undefined) {
    return {};
  }

  const title = page.title;
  const pageId = page.pageid;

  const isPerson = override
    ? Promise.resolve(true)
    : isWikipediaPerson({ title, pageId });
  const isDisambiguation = override
    ? Promise.resolve(false)
    : isDisambiguationPage({ pageId });

  const wikipediaData: Partial<WikipediaData> = {};
  wikipediaData.url = page.canonicalurl;
  wikipediaData.title = title;
  if (!await isPerson) {
    return {};
  } else if (!await isDisambiguation) {
    wikipediaData.thumbnail = await getWikipediaThumbnail({
      title,
      thumbnailHeight,
      pageId,
    });
    wikipediaData.isDisambiguation = false;
  } else {
    wikipediaData.isDisambiguation = true;
  }

  return wikipediaData;
}
