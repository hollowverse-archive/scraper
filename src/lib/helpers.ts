export function replaceSmartQuotes(str: string) {
  // prettier-ignore
  return str.replace(/[‘’]/g, '\'').replace(/[“”]/g, '"');
}
