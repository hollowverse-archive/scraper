import { scrapeHtml, isResultWithContent, Result, isInlinePiece, hasParent, isBlockPiece } from './scrape';
import * as path from 'path';
import * as bluebird from 'bluebird';

import { readDir, readFile } from './helpers';
import { find, uniqBy } from 'lodash';

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
            const piece = find(result.content, (p) => {
              return !isBlockPiece(p) && p.text.length > 0;
            });
            
            expect(piece).toBeDefined();
          }
        }
      });

      it('the parent exists for each piece that references a parent', () => {
        for (const { result } of files) {
          if (isResultWithContent(result)) {
            for (const piece of result.content) {
              if (hasParent(piece)) {
                const parent = find(result.content, { id: piece.parentId });
                expect(parent).toBeDefined();
                expect(parent).toHaveProperty('id', piece.parentId);
              }
            }
          }
        }
      });

      it('each nested block has a unique ID', () => {
        for (const { result } of files) {
          if (isResultWithContent(result)) {
            const children = result.content.filter(isBlockPiece).filter(hasParent);
            expect(uniqBy(children, 'id')).toMatchObject(children);
          }
        }
      });
    });
  }
});
