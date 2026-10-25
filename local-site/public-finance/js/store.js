/* Fetch-and-cache layer for the JSON payloads. Every page sets
   window.PORTAL = {root, state} (stamped by the build); data lives under
   root + 'data/'. */

(function () {
  'use strict';
  const cache = new Map();

  function get(url) {
    let p = cache.get(url);
    if (!p) {
      p = fetch(url).then(r => {
        if (!r.ok) throw new Error(url + ' -> HTTP ' + r.status);
        return r.json();
      });
      p.catch(() => cache.delete(url));
      cache.set(url, p);
    }
    return p;
  }

  const dataUrl = rel => (window.PORTAL ? PORTAL.root : '') + 'data/' + rel;

  window.Store = {
    get,
    index: st => get(dataUrl(st + '/index.json')),
    shard: (st, mj) => get(dataUrl(st + '/major/' + mj + '.json')),
    search: (st, part) => get(dataUrl(st + '/search/' + part + '.json')),
    quality: st => get(dataUrl(st + '/quality.json')),
    states: () => get(dataUrl('states.json')),
    compareIndex: () => get(dataUrl('compare/index.json')),
    asset: rel => get((window.PORTAL ? PORTAL.root : '') + 'assets/' + rel),
  };
})();
