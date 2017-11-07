import { scrapeHtml } from './scrape';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const readFile = promisify(fs.readFile);
const readDir = promisify(fs.readdir);

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

test('every event must have a source URL', async () => {
  (await results).forEach(({ result }) => {
    result.events.forEach(e => {
      expect(e.sourceUrl).toBeTruthy();
    });
  });
});
