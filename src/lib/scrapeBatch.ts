import { readFile, writeFile } from './helpers';
import { scrapeHtml } from './scrape';
import * as bluebird from 'bluebird';
import * as path from 'path';

type ScrapeBatchOptions = {
  distDirectory: string;
  files: string[];
  concurrency: number;
  onScrapedFileWritten?(path: string, next: string | undefined): void;
  onFinished?(): void;
};

export async function scrapeBatch({
  files,
  concurrency,
  distDirectory,
  onScrapedFileWritten,
  onFinished,
}: ScrapeBatchOptions) {
  // tslint:disable-next-line:await-promise
  const data = await bluebird.map(
    files,
    async (file, index) => {
      const html = await readFile(file, 'utf8');
      const result = await scrapeHtml(html);
      const jsonString = JSON.stringify(result, undefined, 2);

      await writeFile(
        path.join(
          distDirectory,
          path.basename(file).replace(/\.html?$/, '.json'),
        ),
        jsonString,
      );

      if (onScrapedFileWritten) {
        onScrapedFileWritten(file, files[index + 1]);
      }

      return file;
    },
    { concurrency },
  );

  if (onFinished) {
    onFinished();
  }

  return data;
}
