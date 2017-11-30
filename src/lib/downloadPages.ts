import { writeFile, fetchPageAsHtml } from './helpers';
import * as bluebird from 'bluebird';
import { URL } from 'url';

type DownloadPagesOptions = {
  distDirectory: string;
  base: string;
  paths: string[];
  concurrency: number;
  onPageDownloaded?(path: string, next: string | undefined): void;
  onFinished?(): void;
};

export async function downloadPages({
  distDirectory,
  paths,
  base,
  concurrency,
  onPageDownloaded,
  onFinished,
}: DownloadPagesOptions) {
  // tslint:disable-next-line:await-promise
  const data = await bluebird.map(
    paths.map(path => [path, new URL(path, base).toString()]),
    async ([path, url], index) => {
      try {
        const html = await fetchPageAsHtml(url);
        await writeFile(`${distDirectory}/${path}.html`, html);

        if (onPageDownloaded) {
          onPageDownloaded(path, paths[index + 1]);
        }
      } catch (e) {
        if (e.statusCode === 404) {
          return;
        }
        throw e;
      }

      return url;
    },
    { concurrency },
  );

  if (onFinished) {
    onFinished();
  }

  return data;
}
