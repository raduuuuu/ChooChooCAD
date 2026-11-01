// Click the stacked spot twice, as a pointer would, and report what happened.
(async () => {
  const settle = () => new Promise((r) => setTimeout(r, 100));
  const ends = [...document.querySelectorAll('g.port')].map((g) => {
    const r = (g.querySelector('.port-dot') || g.querySelector('circle')).getBoundingClientRect();
    return { g, x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  const groups = new Map();
  for (const e of ends) {
    const k = `${Math.round(e.x)},${Math.round(e.y)}`;
    groups.set(k, [...(groups.get(k) || []), e]);
  }
  const spot = [...groups.values()].find((g) => g.length >= 2);
  if (!spot) return { ok: false, why: 'no stacked ends found' };
  const { x, y } = spot[0];
  const joinButtons = document.querySelectorAll('[aria-label^="Join "]').length;
  const click = () => {
    const el = document.elementFromPoint(x, y);
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y }));
    return el.closest('g')?.getAttribute('aria-label') ?? el.tagName;
  };
  const hit1 = click();
  await settle();
  const armed = document.querySelector('g.port.is-armed')?.getAttribute('aria-label') ?? null;
  const hit2 = click();
  await settle();
  const note = document.querySelector('[aria-label="Last move"]')?.innerText.split('\n')[0] ?? null;
  return { ok: Boolean(armed) && /^Joined /.test(note || ''), stacked: spot.length, joinButtons, hit1, armed, hit2, note };
})()
