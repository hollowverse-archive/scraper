#! /usr/bin/env node
import * as program from 'commander';
import * as bluebird from 'bluebird';
import * as path from 'path';
import * as ProgressBar from 'progress';
import { processBatch } from '../lib/processBatch';
import {
  readDir,
  readJsonFile,
  writeFile,
  fetchAsBlob,
  hasKey,
  glob,
} from '../lib/helpers';
import { ResultWithWikipediaData } from './scrape';
import { WikipediaData } from '../lib/getWikipediaInfo';
import { compact } from 'lodash';

// tslint:disable no-console

const defaults = {
  concurrency: 3,
  pattern: '*.json',
};

program
  .description(
    'Download Wikipedia images, reading URLs from scraper result files',
  )
  .option(
    '-p --pattern [pattern]',
    `A glob pattern of result files, must be wrapped in single quotes. Defaults to '${
      defaults.pattern
    }'`,
  )
  .option(
    '-i --input <input>',
    'The path to the directory containing the scraper result files',
  )
  .option(
    '-o --output <output>',
    'The path to the folder where the downloaded image files should be saved.',
  )
  .option('-d --dry', 'Dry run (do not write files to disk).')
  .option(
    '-f --force',
    'Re-download and overwrite files that already exist in the output folder.',
  )
  .option(
    '-c --concurrency [concurrency]',
    'The maximum number of images that should be downloaded at the same time. ' +
      `Defaults to ${defaults.concurrency}`,
  );

program.parse(process.argv);

async function main({
  pattern,
  input,
  output,
  force,
  dry,
  concurrency = defaults.concurrency,
}: Record<string, any>) {
  const resultFiles = await glob(pattern, { cwd: input, matchBase: false });
  let scheduledUrls = compact(
    // tslint:disable-next-line await-promise
    await bluebird.map(resultFiles, async resultFile => {
      const result = await readJsonFile<ResultWithWikipediaData>(
        path.join(input, resultFile),
      );
      if (
        hasKey<WikipediaData, 'wikipediaData'>(result, 'wikipediaData') &&
        result.wikipediaData !== undefined &&
        result.wikipediaData.thumbnail !== undefined
      ) {
        return result.wikipediaData.thumbnail.source;
      }

      return undefined;
    }),
  );

  console.log(`${scheduledUrls.length} URLs found.`);

  if (!force) {
    let alreadyDownloaded: Set<string>;
    try {
      alreadyDownloaded = new Set(await readDir(output));
    } catch (e) {
      alreadyDownloaded = new Set();
    }

    if (alreadyDownloaded.size > 0) {
      console.log(
        `Skipping download of ${
          alreadyDownloaded.size
        } images (already downloaded).`,
      );
      console.log('Pass --force to force downloading of those images.');
    }

    scheduledUrls = scheduledUrls.filter(
      postName => !alreadyDownloaded.has(`${postName}.html`),
    );
  }

  const progressBar = new ProgressBar(':bar [:percent] :path', {
    width: 25,
    total: scheduledUrls.length,
  });

  await processBatch({
    tasks: scheduledUrls,
    processTask: fetchAsBlob,
    concurrency: Number(concurrency),
    async onTaskCompleted(blob, url, nextUrl) {
      if (!dry) {
        await writeFile(path.join(output, `${url}.html`), blob);
      }
      progressBar.tick({ path: nextUrl });
    },
  });

  console.log(
    dry
      ? `${scheduledUrls.length} images downloaded.`
      : `${scheduledUrls.length} images downloaded and written to disk.`,
  );
}

main(program).catch(error => {
  console.error(`Failed to download some images: ${error.message}`);
  process.exit(1);
});
