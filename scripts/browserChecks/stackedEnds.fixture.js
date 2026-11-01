// Ends stacked on one spot at (144, 0), at angles, so the canvas offers no Join button.
// window.FIXTURE: 'two' (default) — a's peg end under b's socket end;
// 'three' — c's socket end, a's peg end (refused against the top), b's peg end on top.
(() => {
  const two = {
    pieces: [{ pieceId: 'a', partId: 'A' }, { pieceId: 'b', partId: 'A' }],
    welds: [],
    anchors: [['b', { pos: [144, 0, 0, 0, 0, 0, 0, 0], heading: 4 }]],
  };
  const three = {
    pieces: [{ pieceId: 'c', partId: 'C' }, { pieceId: 'a', partId: 'A' }, { pieceId: 'b', partId: 'B' }],
    welds: [],
    anchors: [
      ['a', { pos: [144, 0, 0, 0, -144, 0, 0, 0], heading: 4 }],
      ['b', { pos: [144, 0, 0, 0, 144, 0, 0, 0], heading: 12 }],
    ],
  };
  localStorage.clear();
  localStorage.setItem('brio.hint.select.v0', '1');
  localStorage.setItem('brio.graph.v1', JSON.stringify(window.FIXTURE === 'three' ? three : two));
  return `fixture ${window.FIXTURE === 'three' ? 'three' : 'two'} stored`;
})()
