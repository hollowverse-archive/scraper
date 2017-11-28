import { writeFile, fetchPageAsHtml } from './helpers';
import * as bluebird from 'bluebird';
import { URL } from 'url';

type DownloadPagesOptions = {
  distDirectory: string;
  base?: string;
  paths: string[];
  concurrency?: number;
};

export async function downloadPages({
  distDirectory,
  paths,
  base = 'https://static.hollowverse.com',
  concurrency = 3,
}: DownloadPagesOptions) {
  return bluebird.map(
    paths.map(path => [path, new URL(path, base).toString()]),
    async ([path, url]) => {
      return fetchPageAsHtml(url)
        .then(async html => writeFile(`${distDirectory}/${path}.html`, html))
        .catch(e => {
          if (e.statusCode === 404) {
            return;
          }
          throw e;
        });
    },
    { concurrency },
  );
}
