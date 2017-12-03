import { readFile } from './helpers';
import { scrapeHtml, Result } from './scrape';
import * as bluebird from 'bluebird';

type ScrapeBatchOptions<T extends Result = Result> = {
  files: string[];
  concurrency: number;
  transformResult?(result: Result, file: string): Promise<T>;
  onFileScraped(
    result: T,
    file: string,
    next: string | undefined,
  ): Promise<void> | void;
};

export async function scrapeBatch<T extends Result>({
  files,
  concurrency,
  transformResult,
  onFileScraped,
}: ScrapeBatchOptions<T>) {
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
      promises.push(onFileScraped(result as T, file, files[index + 1]));

      return result;
    },
    { concurrency },
  );

  await Promise.all(promises);

  return data;
}
