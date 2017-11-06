// tslint:disable no-console

import * as program from 'commander';
import { scrapePage } from './lib/scrape';
import { URL } from 'url';

program
  .version('1.0')
  .option('-p --path <path>', 'The path of the URL to scrape without the leading slash, e.g. tom-hanks')
  .parse(process.argv);

scrapePage({
  url: new URL(program.path, 'https://static.hollowverse.com').toString()
}).then((output) => {
  console.info(`Webpage ${output.url} scraped successfully`);
  process.exit(0);
})
.catch(e => {
  console.error('Failed to scrape webpage', e.message || e);
  process.exit(1);
});