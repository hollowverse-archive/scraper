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
  return bluebird
    .map(
      paths.map(path => [path, new URL(path, base).toString()]),
      async ([path, url], index) => {
        return fetchPageAsHtml(url)
          .then(async html => writeFile(`${distDirectory}/${path}.html`, html))
          .catch(e => {
            if (e.statusCode === 404) {
              return;
            }
            throw e;
          })
          .then(() => {
            if (onPageDownloaded) {
              onPageDownloaded(path, paths[index + 1]);
            }
          })
          .then(() => url);
      },
      { concurrency },
    )
    .then(data => {
      if (onFinished) {
        onFinished();
      }

      return data;
    });
}
