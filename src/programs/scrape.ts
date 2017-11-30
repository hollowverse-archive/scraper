#! /usr/bin/env node
import * as program from 'commander';
import * as ProgressBar from 'progress';
import * as path from 'path';
import { scrapeBatch } from '../lib/scrapeBatch';
import { readDir, glob } from '../lib/helpers';

const defaults = {
  concurrency: 3,
};

program
  .description('Scrape downloaded website pages')
  .option(
    '-p --pattern <pattern>',
    'A glob pattern of HTML files to scrape, must be wrapped in single quotes',
  )
  .option(
    '-r --root <root>',
    'The directory containing the downloaded HTML files',
  )
  .option(
    '-o --output <output>',
    'The path where to scraping results should be saved',
  )
  .option(
    '-f --force',
    'Re-scrape and overwrite files that already exist in the output folder.',
  )
  .option(
    '-c --concurrency [concurrency]',
    'The maximum number of pages that should should be scraped at the same time. ' +
      `Defaults to ${defaults.concurrency}`,
  );

program.parse(process.argv);

async function main({
  pattern,
  root,
  output,
  force,
  concurrency = defaults.concurrency,
}: Record<string, any>) {
  const files = await glob(pattern, { cwd: root, matchBase: false });
  let scheduledFiles = files;

  if (!force) {
    let alreadyScraped: Set<string>;
    try {
      alreadyScraped = new Set(await readDir(output));
    } catch (e) {
      alreadyScraped = new Set();
    }

    scheduledFiles = scheduledFiles.filter(
      file => !alreadyScraped.has(file.replace(/\.html?$/, '.json')),
    );
  }

  const progressBar = new ProgressBar(':bar [:percent] :page', {
    width: 25,
    total: scheduledFiles.length,
  });

  return scrapeBatch({
    files: scheduledFiles.map(file => path.join(root, file)),
    concurrency: Number(concurrency),
    distDirectory: output,
    onScrapedFileWritten(_, next) {
      progressBar.tick({ page: next });
    },
    onFinished() {
      process.stdout.write(`${files.length} scraped and written to disk.\n`);
    },
  });
}

main(program).catch(error => {
  process.stderr.write(`\n${error.message}\n`);
  process.exit(1);
});
