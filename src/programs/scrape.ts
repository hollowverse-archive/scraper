#! /usr/bin/env node
import * as program from 'commander';
import * as ProgressBar from 'progress';
import * as path from 'path';
import { Result } from '../lib/scrape';
import { scrapeBatch } from '../lib/scrapeBatch';
import { readDir, glob, writeFile } from '../lib/helpers';
import { getWikipediaInfo } from '../lib/getWikipediaInfo';
import { isEmpty } from 'lodash';

const defaults = {
  concurrency: 3,
};

function hasWikipediaData(
  result: Result,
): result is Result & { wikipediaData: Record<string, any> } {
  return 'wikipediaData' in result;
}

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
    '--no-wikipedia',
    'Do not add corresponding Wikipedia page URL to results',
  )
  .option(
    '-o --output <output>',
    'The path where to scraping results should be saved',
  )
  .option(
    '-f --force',
    'Re-scrape and overwrite files that already exist in the output folder.',
  )
  .option('-d --dry', 'Dry run (do not write files to disk).')
  .option(
    '-c --concurrency [concurrency]',
    'The maximum number of pages that should be scraped at the same time. ' +
      `Defaults to ${defaults.concurrency}`,
  );

program.parse(process.argv);

async function main({
  pattern,
  root,
  output,
  force,
  wikipedia,
  dry,
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

    process.stdout.write(
      `\n${files.length -
        scheduledFiles.length} already scraped and --force was not passed.\n`,
    );
  }

  const progressBar = new ProgressBar(':bar [:percent] :page', {
    width: 25,
    total: scheduledFiles.length,
  });

  const results = await scrapeBatch({
    files: scheduledFiles.map(file => path.join(root, file)),
    concurrency: Number(concurrency),
    async onFileScraped(result, file, _) {
      if (!dry) {
        await writeFile(
          path.join(output, path.basename(file).replace(/\.html?$/, '.json')),
          JSON.stringify(result, undefined, 2),
        );
      }
      progressBar.tick({ page: file });
    },

    async transformResult(result, __) {
      if (wikipedia) {
        const wikipediaData = await getWikipediaInfo(result);

        return {
          ...result,
          wikipediaData,
        };
      }

      return result;
    },
  });

  process.stdout.write(
    `\n${scheduledFiles.length} scraped${
      !dry ? ' and written to disk' : ''
    }.\n`,
  );

  const missingData = results.filter(result => {
    if (hasWikipediaData(result)) {
      return isEmpty(result.wikipediaData);
    }

    return false;
  });

  if (missingData.length) {
    process.stdout.write(
      `\nCould not find matching Wikipedia page(s) for ${
        missingData.length
      } page(s):\n`,
    );

    missingData.forEach(({ name }) => {
      process.stdout.write(`* ${name}\n`);
    });
  }
}

main(program).catch(error => {
  process.stderr.write(`\n${error.message}\n`);
  process.exit(1);
});
