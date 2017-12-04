#! /usr/bin/env node
import * as program from 'commander';
import * as path from 'path';
import * as ProgressBar from 'progress';
import { processBatch } from '../lib/processBatch';
import { readDir, readJsonFile, writeFile, fetchAsHtml } from '../lib/helpers';
import { URL } from 'url';

// tslint:disable no-console

const defaults = {
  base: 'https://static.hollowverse.com',
  concurrency: 3,
};

type Path = {
  post_name: string;
};

program
  .description(
    'Download pages of the website, reading URL paths from a JSON file',
  )
  .option(
    '-i --input <input>',
    'The path to the JSON file containing an array of URL paths to download',
  )
  .option(
    '-o --output <output>',
    'The path to the folder where the downloaded HTML files should be saved.',
  )
  .option(
    '-b --base [base]',
    `The website domain name to download from. Defaults to ${defaults.base}`,
  )
  .option('-d --dry', 'Dry run (do not write files to disk).')
  .option(
    '-f --force',
    'Re-download and overwrite files that already exist in the output folder.',
  )
  .option(
    '-c --concurrency [concurrency]',
    'The maximum number of pages that should be downloaded at the same time. ' +
      `Defaults to ${defaults.concurrency}`,
  );

program.parse(process.argv);

async function main({
  input,
  output,
  force,
  dry,
  base = defaults.base,
  concurrency = defaults.concurrency,
}: Record<string, any>) {
  const postNames = await readJsonFile<Path[]>(input);
  let scheduledPaths = postNames.map(p => p.post_name);
  console.log(`${scheduledPaths.length} posts found.`);

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
        } pages (already downloaded).`,
      );
      console.log('Pass --force to force downloading of those pages.');
    }

    scheduledPaths = scheduledPaths.filter(
      postName => !alreadyDownloaded.has(`${postName}.html`),
    );
  }

  const progressBar = new ProgressBar(':bar [:percent] :path', {
    width: 25,
    total: scheduledPaths.length,
  });

  await processBatch({
    tasks: scheduledPaths.map(p => String(new URL(p, base))),
    processTask: fetchAsHtml,
    concurrency: Number(concurrency),
    async onTaskCompleted(html, urlPath, next) {
      if (!dry) {
        await writeFile(path.join(output, `${urlPath}.html`), html);
      }
      progressBar.tick({ path: next });
    },
  });

  console.log(
    dry
      ? `${scheduledPaths.length} URLs downloaded.`
      : `${scheduledPaths.length} URLs downloaded and written to disk.`,
  );
}

main(program).catch(error => {
  console.error(`Failed to download some pages: ${error.message}`);
  process.exit(1);
});
