import { scrapeHtml } from './scrape';
import * as path from 'path';

import { readDir, readFile } from './helpers';

const fixturesDir = 'fixtures/html';
const results = readDir(fixturesDir).then(async files => {
  return Promise.all(
    files.map(async file => {
      const html = await readFile(path.resolve(fixturesDir, file), 'utf8');

      return {
        file,
        result: await scrapeHtml(html),
      };
    }),
  );
});

test('parses and scrapes HTML correctly', async () => {
  (await results).forEach(({ file, result }) => {
    expect(result).toMatchSnapshot(file);
  });
});
