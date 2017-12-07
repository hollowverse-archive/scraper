import * as fs from 'fs';
import { promisify } from 'util';
import * as _glob from 'glob';

export const readFile = promisify(fs.readFile);
export const writeFile = promisify(fs.writeFile);
export const readDir = promisify(fs.readdir);
export const removeFile = async (path: string) =>
  new Promise((resolve, reject) => {
    fs.unlink(path, err => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });

export const glob = async (pattern: string, options: _glob.IOptions = {}) => {
  return new Promise<string[]>((resolve, reject) => {
    _glob(pattern, options, (error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
};

export const readJsonFile = async <T = any>(file: string) =>
  readFile(file, 'utf8').then(JSON.parse) as Promise<T>;

export function replaceSmartQuotes(str: string) {
  // prettier-ignore
  return str.replace(/[‘’]/g, '\'').replace(/[“”]/g, '"');
}

export function hasKey<
  V = any,
  K extends string = string,
  O = Record<string, any>
>(obj: O, k: K): obj is (typeof obj) & Record<K, V> {
  return k in obj;
}
