#! /usr/bin/env node
import * as program from 'commander';
import { getStatusForPost } from '../lib/getStatusForPost';
import { readJsonFile, writeFile } from '../lib/helpers';
import * as bluebird from 'bluebird';

program
  .description(
    'Determines the status of a post, given the required database dump data',
  )
  .option(
    '-p --posts <posts>',
    'The path to the JSON file containing an array of post details, ' +
      'as exported from WordPress database',
  )
  .option(
    '-t --terms <terms>',
    'The path to the JSON file containing an array of term details, ' +
      '(term_id, slug) as exported from WordPress database',
  )
  .option(
    '-x --term-taxonomy <term-taxonomy>',
    'The path to the JSON file containing an array of term taxonomy relationships, ' +
      '(term_id, term_taxonomy_id) as exported from WordPress database',
  )
  .option(
    '-o --output <output>',
    'The path where the results file should be saved, if not specified, outputs to stdout',
  );

program.parse(process.argv);

async function main({
  posts: postsFile,
  terms: termsFile,
  termTaxonomy: termTaxonomyFile,
  output,
}: Record<string, any>) {
  return bluebird
    .map([postsFile, termsFile, termTaxonomyFile], readJsonFile)
    .then(async ([posts, terms, termTaxonomy]) => {
      const data = await getStatusForPost(posts, terms, termTaxonomy);
      const jsonString = JSON.stringify(data, undefined, 2);
      if (output) {
        return writeFile(output, jsonString);
      } else {
        process.stdout.write(jsonString);
      }
    });
}

main(program).catch(error => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
