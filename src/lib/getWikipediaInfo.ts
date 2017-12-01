import { Result } from './scrape';
import * as got from 'got';
import { values } from 'lodash';

const WIKIPEDIA_API_ENDPOINT = 'https://en.wikipedia.org/w/api.php';

export async function getWikipediaInfo(result: Result) {
  const personRequest = got(WIKIPEDIA_API_ENDPOINT, {
    json: true,
    query: {
      action: 'query',
      prop: 'templates',
      titles: result.name,
      tltemplates: 'Person',
      format: 'json',
    },
  });

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

  const personBody = (await personRequest).body;
  const urlBody = (await urlRequest).body;

  const pageId = values(personBody.query.pages)[0].pageid;

  const {
    title: wikipediaTitle,
    canonicalurl: wikipediaUrl,
  } = urlBody.query.pages[pageId];

  return {
    wikipediaUrl,
    wikipediaTitle,
  };
}
