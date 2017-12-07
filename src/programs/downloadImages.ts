#! /usr/bin/env node
import * as program from 'commander';
import * as bluebird from 'bluebird';
import * as path from 'path';
import fetch from 'node-fetch';
import * as ProgressBar from 'progress';
import { processBatch } from '../lib/processBatch';
import { readDir, readJsonFile, writeFile, hasKey, glob } from '../lib/helpers';
import { ResultWithWikipediaData } from './scrape';
import { WikipediaData } from '../lib/getWikipediaInfo';

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
  let results = (await bluebird.map(resultFiles, async resultFile => {
    // tslint:disable-next-line await-promise
    const result = await readJsonFile<ResultWithWikipediaData>(
      path.join(input, resultFile),
    );
    if (
      hasKey<WikipediaData, 'wikipediaData'>(result, 'wikipediaData') &&
      result.wikipediaData !== undefined &&
      result.wikipediaData.thumbnail !== undefined
    ) {
      const slug = decodeURI(result.wikipediaData.url).replace(
        'https://en.wikipedia.org/wiki/',
        '',
      );
      const imageUrl = result.wikipediaData.thumbnail.source;
      const ext = imageUrl.match(/\.[a-z]{3,4}$/gi);
      let filename = slug;
      if (ext && ext[0]) {
        filename += ext[0].toLowerCase();
      }

      return {
        slug,
        imageUrl,
        filename,
      };
    }

    return undefined;
  })).filter(obj => obj !== undefined) as Array<{
    slug: string;
    imageUrl: string;
    filename: string;
  }>;

  console.log(`${results.length} URLs found.`);

  if (!force) {
    let alreadyDownloaded: Set<string>;
    try {
      alreadyDownloaded = new Set(await readDir(output));
    } catch (e) {
      alreadyDownloaded = new Set();
    }

    const filteredResults = results.filter(
      ({ filename }) => !alreadyDownloaded.has(filename),
    );

    const diff = results.length - filteredResults.length;

    if (diff > 0) {
      results = filteredResults;
      console.log(`Skipping download of ${diff} images (already downloaded).`);
      console.log('Pass --force to force downloading of those images.');
    }
  }

  const progressBar = new ProgressBar(':bar [:percent] :path', {
    width: 25,
    total: results.length,
  });

  await processBatch({
    tasks: results,
    processTask: async ({ imageUrl }) => (await fetch(imageUrl)).buffer(),
    concurrency: Number(concurrency),
    async onTaskCompleted(body, task) {
      if (!dry) {
        await writeFile(path.join(output, task.filename), body);
      }
      progressBar.tick({ path: task.slug });
    },
  });

  console.log(
    dry
      ? `${results.length} images downloaded.`
      : `${results.length} images downloaded and written to disk.`,
  );
}

main(program).catch(error => {
  console.error(`Failed to download some images: ${error.message}`);
  process.exit(1);
});
