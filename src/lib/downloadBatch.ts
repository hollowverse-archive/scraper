import { fetchPageAsHtml } from './helpers';
import * as bluebird from 'bluebird';
import { URL } from 'url';

type DownloadPagesOptions = {
  base: string;
  paths: string[];
  concurrency: number;
  onPageDownloaded(
    html: string,
    urlPath: string,
    next: string | undefined,
  ): void;
};

export async function downloadBatch({
  paths,
  base,
  concurrency,
  onPageDownloaded,
}: DownloadPagesOptions) {
  return bluebird.map(
    paths.map(path => [path, new URL(path, base).toString()]),
    async ([path, url], index) => {
      try {
        const html = await fetchPageAsHtml(url);
        onPageDownloaded(html, path, paths[index + 1]);
      } catch (e) {
        if (e.statusCode !== 404) {
          throw e;
        }
      }

      return url;
    },
    { concurrency },
  );
}
