import { getStatusForPost } from './getStatusForPost';
import * as path from 'path';

import { readJsonFile } from './helpers';

const fixtures = ['terms.json', 'termTaxonomy.json']
  .map(file => path.join('fixtures', file))
  .map(readJsonFile);

const postsWithChildren = ['tomHanks.json', 'oliviaWilde.json']
  .map(file => path.join('fixtures', 'postsWithChildren', file))
  .map(readJsonFile);

test('gets the correct status for each parent post', async () => {
  const [terms, termTaxonomy] = await Promise.all(fixtures);

  (await Promise.all(postsWithChildren)).forEach(async postWithChildren => {
    expect(
      await getStatusForPost(postWithChildren, terms, termTaxonomy),
    ).toMatchSnapshot();
  });
});
