import { readFile } from './helpers';
import { scrapeHtml, Result } from './scrape';
import * as bluebird from 'bluebird';

type ScrapeBatchOptions = {
  files: string[];
  concurrency: number;
  onScrapedFileWritten(
    result: Result,
    file: string,
    next: string | undefined,
  ): void;
  onFinished?(): void;
};

export async function scrapeBatch({
  files,
  concurrency,
  onScrapedFileWritten,
  onFinished,
}: ScrapeBatchOptions) {
  // tslint:disable-next-line:await-promise
  const data = await bluebird.map(
    files,
    async (file, index) => {
      const html = await readFile(file, 'utf8');
      const result = await scrapeHtml(html);

      onScrapedFileWritten(result, file, files[index + 1]);

      return file;
    },
    { concurrency },
  );

  if (onFinished) {
    onFinished();
  }

  return data;
}
