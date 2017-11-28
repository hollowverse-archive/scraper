#! /usr/bin/env node
import * as program from 'commander';
import * as writeJsonFile from '@hollowverse/common/helpers/writeJsonFile';
import { scrapePage } from './lib/scrape';
import { URL } from 'url';

const DEFAULT_BASE = 'https://static.hollowverse.com';

program
  .version('1.0')
  .option(
    '-p --path <path>',
    'The path of the URL to scrape without the leading slash, e.g. tom-hanks',
  )
  .option(
    '-b --base [base]',
    `The hostname of the website to be scraped, defaults to ${DEFAULT_BASE}`,
  )
  .option(
    '-o --output [output]',
    'If specified, the output data will be written to the specified path, ' +
      'otherwise, output is written to stdout',
  )
  .parse(process.argv);

scrapePage({
  url: new URL(program.path, program.base || DEFAULT_BASE).toString(),
})
  .then(output => JSON.stringify(output, undefined, 2))
  .then(async json => {
    if (program.output) {
      await writeJsonFile(program.output, json);
    } else {
      process.stdout.write(json);
    }
    process.exit(0);
  })
  .catch(e => {
    process.stderr.write(`Failed to scrape webpage ${e.message || e}\n`);
    process.exit(1);
  });
