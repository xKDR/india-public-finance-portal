# Revised India Public Finance Portal

This branch (`ipfp_revisions`) contains the revised static website in `local-site/`.
The existing repository budget sources are unchanged. The website is ready for review;
this commit does not change the existing Cloudflare deployment.

## Review locally

From the repository root with Node.js installed:

```
node serve-preview.mjs
```

Open http://127.0.0.1:4180/index.html (the homepage) or
http://127.0.0.1:4180/explore.html (the new Explore workspace).
No dependencies or frontend build are needed. Generated JSON is included.

## Deploy with Cloudflare Pages

Connect this repository, select branch `ipfp_revisions`, leave the build command
empty, and set the build output directory to `local-site` (repository root directory).
For an existing project, deploy a preview of this branch first and review it before
changing the production branch. Updating this branch alone will not update an
existing project configured to deploy a different branch.

The homepage is `/`; States is `/public-finance/`; Explore is `/explore.html`.
Use the entire `local-site` directory so scripts, data, images and relative links
are deployed together. Keep the visible recovered-preview notice and review the
known limitations below before publishing.

## Changes included

- Consolidated state navigation and added a separate Explore page.
- Karnataka/Tamil Nadu account search, additive selected-head tables, multi-select
  fiscal years and CSV downloads.
- Consistent BE, RE and Actuals chart styles; removed Budget restated controls.
- Corrected percentage chart gaps caused by filtering small valid denominators.
- Clearer dashboard hierarchy/share descriptions and doughnut labels.
- Simplified single-year/cumulative explorer controls; removed summary panels.
- Revised homepage layout, navigation and Spending as planned use case.

## Data provenance and limits

All explorer budget data is generated from this repository's `state-finances/`
files at source commit `371c1e5d79a7f2dfcb8d55f21867330384093910`.
No live Cloudflare financial data is used. `schema-*.json` contain presentation
labels only. The supplied Leap article is attributed editorial material in the
use case; its statistics are not claimed as recomputed explorer results.

These are recovered deployed frontend artifacts with local revisions, rather than
the original frontend build sources. Detailed account quality badges and deeper
comparison search remain incomplete. Raw extraction values can differ from the
previous live processed data. One malformed Karnataka row is excluded from
calculations and preserved in `local-site/public-finance/data/excluded-rows.json`.
See `LOCAL-PREVIEW.md` for recovery history and additional caveats. Its references
to a `portal/` clone describe the original workspace; the scripts on this branch
now read directly from this repository root.

## Verification and data rebuild

Run from repository root:

```
node verify-preview.mjs
node verify-compare.mjs
node verify-selected-heads.mjs
```

To regenerate financial JSON from repository sources (not necessary to preview):

```
node build-local-data.mjs
node prepare-preview.mjs
```

Do not recover the frontend again: the revised frontend is already tracked here.
