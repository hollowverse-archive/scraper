import { getStatusForPost } from './getStatusForPost';
import * as path from 'path';

import { readDir, readFile } from './helpers';

const fixtures = ['terms.json', 'termTaxonomy.json']
  .map(file => path.join('fixtures', file))
  .map(async file => readFile(file, 'utf8'))
  .map(async string => JSON.parse(await string));

const postsWithChildren = ['tomHanks.json', 'oliviaWilde.json']
  .map(file => path.join('fixtures', 'postsWithChildren', file))
  .map(async file => readFile(file, 'utf8'))
  .map(async string => JSON.parse(await string));

test('parses and scrapes HTML correctly', async () => {
  const [terms, termTaxonomy] = await Promise.all(fixtures);

  (await Promise.all(postsWithChildren)).forEach(async postWithChildren => {
    expect(
      await getStatusForPost(postWithChildren, terms, termTaxonomy),
    ).toMatchSnapshot();
  });
});
