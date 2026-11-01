/**
 * LEAVING A SHARED LINK (share plan, eng D8, D28): the `#v…` comes off the
 * address without a new history entry, then the page reloads into the editor.
 * So Back leaves the site rather than reopening the link, and a reload can
 * never run the link again. Every exit uses this: Back to my layout, Start
 * your own, the refusal and crash screens.
 */
export function leaveLink(): void {
  history.replaceState(history.state, '', location.pathname + location.search);
  location.reload();
}
