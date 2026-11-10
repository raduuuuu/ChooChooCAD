/**
 * THE BRAND WORDS, ONCE (AGENTS.md "Names and sources"): the repo checkup
 * (`engine/tools/checkup.ts`) finds them in committed text, and the
 * untrusted-part validator (`untrustedPart.ts`) in a submitted piece's
 * strings. Their own module, free of Node, so the app's preview can load the
 * validator too (contributor-brief T3).
 */

/** The brand words, base64 so no file names one in plain text (AGENTS.md); the tests build their fixtures from them. */
const TERMS_B64 = 'YnJpbyxpa2VhLGxpbGxhYm8scGxheXRpdmUsaGFwZSx0aG9tYXMsbWVsaXNzYSxsaWRsLGJpZ2ppZ3MsdGVzY28sbWF4aW0samVzc2UsbHVwaWx1';
export const TERMS: readonly string[] = atob(TERMS_B64).split(',');
const TERM_SET = new Set(TERMS);

/** Words: split on non-letters and at case changes, so `fooBar`, `FOOBar`, `FOO_BAR` and `foo2` each yield `foo`. */
export const SPLIT = /[^A-Za-z]+|(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/;

/** The brand words in `text`, as written there. */
export const brandWords = (text: string): string[] => text.split(SPLIT).filter((w) => TERM_SET.has(w.toLowerCase()));
