declare module 'fuzzyset.js' {
  interface FuzzySet {
    get(candidate: string): Array<[number, string]>;
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
