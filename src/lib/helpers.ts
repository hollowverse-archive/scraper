import * as fs from 'fs';
import * as got from 'got';
import { promisify } from 'util';

export const readFile = promisify(fs.readFile);
export const writeFile = promisify(fs.writeFile);
export const readDir = promisify(fs.readdir);

export function replaceSmartQuotes(str: string) {
  // prettier-ignore
  return str.replace(/[‘’]/g, '\'').replace(/[“”]/g, '"');
}

export async function fetchPageAsHtml(url: string) {
  const response = await got(url, {
    headers: {
      Accept: 'text/html',
    },
  });

  return response.body;
}
