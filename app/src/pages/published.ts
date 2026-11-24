/**
 * EVERY ADDRESS THE SITE HAS PUBLISHED (owner, 2026-11-22:
 * "Add the guard"). A search engine keeps an address long after it is
 * listed, and this site cannot redirect, so an address that stops being
 * built is a dead link in someone's search results.
 *
 * APPEND ONLY. The test compares this list with the pages the build makes,
 * both ways: a listed address that is no longer built fails, and so does a
 * built address that is not listed. Renaming a layout therefore fails until
 * someone decides, here and in review, to give its old address up.
 */
export const PUBLISHED: readonly string[] = [
  '/',
  '/layouts/',
  '/layouts/circle.html',
  '/layouts/stadium.html',
  '/layouts/long-oval.html',
  '/layouts/rounded-square.html',
  '/layouts/bean.html',
  '/layouts/peanut.html',
  '/layouts/dog-bone.html',
  '/why-a-loop-will-not-close/',
  '/sizes/',
];
