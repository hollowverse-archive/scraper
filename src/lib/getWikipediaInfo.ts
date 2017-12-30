import { Result } from './scrape';
import * as got from 'got';
import * as createFuzzySet from 'fuzzyset.js';
import { find } from 'lodash';

import { WIKIPEDIA_API_ENDPOINT } from './wikipedia/constants';
import { MetadataKey } from './wikipedia/types';
import { getFileMetadata } from './wikipedia/getFileMetadata';
import { isWikipediaPerson } from './wikipedia/isWikipediaPerson';
import { getPageImage } from './wikipedia/getPageImage';
import { isDisambiguationPage } from './wikipedia/isDisambiguationPage';
import { extractFirstRelevantPageImage } from './wikipedia/extractFirstRelevantPageImage';

export type WikipediaData = {
  url: string;
  title: string;
  image?: {
    name: string;
    info: {
      canonicaltitle: string;
      thumburl: string;
      thumbwidth: number;
      thumbheight: number;
      url: string;
      descriptionurl: string;
      descriptionshorturl: string;
      extmetadata: Partial<
        Record<MetadataKey, { source: string; value: string }>
      >;
    };
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
  pageUrlOverride?: string;

  /**
   * Filename of Wikipedia image to use instead of attempting
   * to find a relevant image.
   */
  pageImageOverride?: string | null;
};

// tslint:disable-next-line:max-func-body-length
export async function getWikipediaInfo({
  result,
  thumbnailHeight = 300,
  pageUrlOverride,
  pageImageOverride,
}: GetWikipediaInfoOptions): Promise<Partial<WikipediaData>> {
  const response = await got(WIKIPEDIA_API_ENDPOINT, {
    json: true,
    query: {
      action: 'query',
      generator: 'search',
      gsrsearch: pageUrlOverride
        ? decodeURI(pageUrlOverride)
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
  if (typeof pageUrlOverride === 'string') {
    page = find(pages, p => p.canonicalurl === pageUrlOverride);
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

  const isPerson = pageUrlOverride
    ? Promise.resolve(true)
    : isWikipediaPerson({ title, pageId });

  const isDisambiguation = pageUrlOverride
    ? Promise.resolve(false)
    : isDisambiguationPage({ pageId });

  const wikipediaData: Partial<WikipediaData> = {};
  wikipediaData.url = page.canonicalurl;
  wikipediaData.title = title;
  if (!await isPerson) {
    return {};
  } else if (!await isDisambiguation) {
    let pageImage: string | null | undefined;

    if (pageImageOverride !== undefined) {
      pageImage = pageImageOverride;
    } else {
      pageImage =
        (await getPageImage({ pageId })) ||
        (await extractFirstRelevantPageImage({ pageId, title }));
    }

    if (pageImage) {
      const info = await getFileMetadata({
        filename: pageImage,
        thumbnailHeight,
      });
      wikipediaData.image = {
        name: pageImage,
        info,
      };
    }
    wikipediaData.isDisambiguation = false;
  } else {
    wikipediaData.isDisambiguation = true;
  }

  return wikipediaData;
}
