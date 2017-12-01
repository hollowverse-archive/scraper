import { readFile } from './helpers';
import { scrapeHtml, Result } from './scrape';
import * as bluebird from 'bluebird';

type ScrapeBatchOptions = {
  files: string[];
  concurrency: number;
  transformResult?(result: Result, file: string): Promise<Result>;
  onFileScraped(
    result: Result,
    file: string,
    next: string | undefined,
  ): Promise<void> | void;
  onFinished?(): void;
};

export async function scrapeBatch({
  files,
  concurrency,
  transformResult,
  onFileScraped,
  onFinished,
}: ScrapeBatchOptions) {
  const promises: Array<void | Promise<void>> = [];

  // tslint:disable-next-line:await-promise
  const data = await bluebird.map(
    files,
    async (file, index) => {
      const html = await readFile(file, 'utf8');
      let result = await scrapeHtml(html);
      if (transformResult) {
        result = await transformResult(result, file);
      }
      promises.push(onFileScraped(result, file, files[index + 1]));

      return result;
    },
    { concurrency },
  );

  await Promise.all(promises);

  if (onFinished) {
    onFinished();
  }

  return data;
}
