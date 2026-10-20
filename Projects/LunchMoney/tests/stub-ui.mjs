const n = () => {};
const el = { remove: n, classList: { contains: () => false } };
const rec = (...a) => { if (globalThis.__rec) globalThis.__rec(...a); };
export const applyCrt = n, bind = n, boardEl = () => null, bumpCalc = n, celebrate = n, cellEl = () => null, hit = n, jig = n,
  jokerEl = () => null, markCells = n, pop = n, refreshModal = n, refreshRack = n, render = n, replayTips = n, setCalc = n,
  setMoney = n, setRoundScore = n, shake = n, toast = (m) => rec('toast', m);
export const showTotal = (total) => rec('total', total);
export const showModal = n;
export const banner = (txt, bad) => { rec('banner', txt, bad); return el; };
export const shatter = n, flyFrom = n, sellFx = n, itemEl = () => null, shopEl = () => null;
export const react = () => {};
export const levelFx = () => {};
export const flash = n, markEnter = n, flipRack = n, rackRects = () => new Map();
export const face = () => '';
