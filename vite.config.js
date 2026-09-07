import { defineConfig } from 'vite';

// The game is published as a GitHub Pages *project* site, so it is served from
// https://<user>.github.io/Getaway/ rather than the domain root. `base` makes
// Vite emit bundle/asset URLs under that prefix.
//
// Phaser's own `this.load.*` calls use document-relative paths ('Tilemap.png'),
// which resolve against /Getaway/ automatically and so need no prefixing.
//
// Set unconditionally (not just in CI) so `npm run build` locally produces the
// exact artifact that gets deployed. `npm run dev` and `npm run preview` then
// serve at http://localhost:<port>/Getaway/.
export default defineConfig({
  base: '/Getaway/',
});
