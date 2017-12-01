import { scrapeHtml, isResultWithContent, Result, isPiece } from './scrape';
import * as path from 'path';
import * as bluebird from 'bluebird';

import { readDir, readFile } from './helpers';

const types = ['complete', 'incomplete', 'stub'];

describe('works for all post types', async () => {
  for (const type of types) {
    describe(`works for ${type} posts`, async () => {
      let files: Array<{ filename: string; result: Result }>;

      beforeAll(async () => {
        // tslint:disable-next-line:await-promise
        files = await bluebird.map(
          readDir(path.join('fixtures', 'html', type)),
          async filename => {
            const html = await readFile(
              path.join('fixtures', 'html', type, filename),
              'utf8',
            );

            return {
              filename,
              result: await scrapeHtml(html),
            };
          },
        );
      });

      it('matches snapshot', () => {
        for (const { result, filename } of files) {
          expect(result).toMatchSnapshot(filename);
        }
      });

      it('every post has a name', () => {
        for (const { result } of files) {
          expect(result.name).toBeDefined();
          expect(result.name.length).toBeGreaterThan(0);
        }
      });

      it('posts that are not stubs must have some content', () => {
        for (const { result } of files) {
          if (isResultWithContent(result)) {
            expect(result.content.length).toBeGreaterThan(0);
            const piece = result.content[0];
            if (isPiece(piece)) {
              expect(piece.text.length).toBeGreaterThan(0);
            }
          }
        }
      });
    });
  }
});
