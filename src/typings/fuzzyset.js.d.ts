declare module 'fuzzyset.js' {
  interface FuzzySet {
    get<T = undefined>(
      candidate: string,
      defaultValue?: T | undefined,
      minScore?: number,
    ): Array<[number, string]> | T | null;
    add(value: string): boolean;
    length(): number;
    isEmpty(): boolean;
    values(): string[];
  }

  // tslint:disable-next-line
  function FuzzySet(
    source: string[],
    useLevenshtein?: boolean,
    gramSizeLower?: number,
    gramSizeUpper?: number,
  ): FuzzySet;

  namespace FuzzySet {

  }

  export = FuzzySet;
}
