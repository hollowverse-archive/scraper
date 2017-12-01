declare module 'fuzzyset.js' {
  interface FuzzySet {
    get(candidate: string): Array<[number, string]>;
    add(value: string): boolean;
    length(): number;
    isEmpty(): boolean;
    values(): string[];
  }

  function createFuzzySet(
    source: string[],
    useLevenshtein?: boolean,
    gramSizeLower?: number,
    gramSizeUpper?: number,
  ): FuzzySet;

  export default createFuzzySet;
}
