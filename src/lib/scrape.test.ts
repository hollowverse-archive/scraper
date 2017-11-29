// tslint:disable:mocha-no-side-effect-code
import { scrapeHtml, isResultWIthContent } from './scrape';
import * as path from 'path';

import { readDir, readFile } from './helpers';

const types = ['complete', 'incomplete', 'stub'];

it('works for different types of posts', async () => {
  for (const type of types) {
    const filenames = await readDir(path.join('fixtures', 'html', type));
    const files = filenames.map(async filename => ({
      filename,
      html: await readFile(
        path.join('fixtures', 'html', type, filename),
        'utf8',
      ),
    }));

    await Promise.all(
      files.map(async descriptor => {
        const { filename, html } = await descriptor;
        const result = await scrapeHtml(html);
        expect(result.name).toBeDefined();
        if (isResultWIthContent(result)) {
          expect(result.content.length).toBeGreaterThan(0);
        }
        expect(result).toMatchSnapshot(filename);
      }),
    );
  }
});
