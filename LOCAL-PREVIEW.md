# Local website preview

The worked health example, Working with the data guide, and interactive Explore
workspace now live at `/explore.html`, linked from the shared navigation. They
have been removed from the homepage. The example is rebuilt directly from the
repository-backed Karnataka index (revenue heads 2210 and 2211); its year selector
is functional. The guide image is copied from the repository. Search, state tabs,
multi-year selection and exports share the existing implementation on the new
page. Data in practice remains on the homepage before Coverage and validation.

State tabs now switch the Explore workspace in place without reloading the page.
Their viewport position is restored after rendering the new state; late shard
responses from a previous state cannot populate a new selection.
The former research-questions block is replaced by a See use case disclosure
about drug-procurement budget execution. It explains why structured data was
essential, outlines a reproducible analysis workflow, attributes the published
findings to the supplied Leap Blog article, and links to that work. Article
summary statistics are attributed editorial content, not imported explorer data
or a claimed recomputation from a single selected account head.

The Explore section now has Karnataka and Tamil Nadu state tabs. Each tab
loads its own repository search index, additive-head data, fiscal-year choices,
CSV exports and expandable account table. Explore state is recorded in the URL
(`?exploreState=ka` or `?exploreState=tn`); switching tabs starts a fresh selection.
The landing-page worked examples and coverage section continue to describe
Karnataka independently of the Explore state. Tamil Nadu native amounts use
10,000 thousand per crore, and Karnataka uses 100 lakh per crore.

Landing-page search selections now populate a separate Selected account heads
table. Each result identifies a specific major head; adding additional search
results builds the comparison. Aggregation matches the selected level, code and
normalized name across all repository leaf paths under that major, counting each
path once. BE, RE and Actuals use the same fiscal year, selectable independently
of the original document-year table. Missing values display as a dash, printed
zeros as zero. CSV export preserves full precision, units and source commit.
The original expandable table remains available at the latest document year.
Its separate document-year selector and download control have been removed
from the search toolbar. The selected-head table has one multi-select fiscal
year dropdown with an All years option; its CSV follows the selected years.
Run `node verify-selected-heads.mjs` to verify both Drugs and Chemicals examples
against source NDJSON and exercise the CSV handler. Selections last for the
current page session and can be removed or cleared.

The state dashboards, time-series pages and explorers now expose only Budget,
Revised and Actuals. Restated BE remains in the source data but is not displayed
or used as a fallback for budget-based ratios. Dashboard slices start at major
account heads and follow the next available printed hierarchy level. A dynamic
displayed-level label identifies the children currently shown. Shares use the
sum of positive sibling amounts; negative recoveries remain in the table.
Full head names and shares are in a wrapping legend, with fitted totals and
percentage-only labels inside the ring.

Open http://127.0.0.1:4180/public-finance/ while the preview server is running.
Restart it from this workspace with `node serve-preview.mjs`.

## Navigation change

The recovered HTML in `local-site/` removes Karnataka and Tamil Nadu from the
shared Site navigation. States retains its map and both state cards, linking
to each state's explorer, dashboard, and time series. The state-specific
Explore / Dashboard / Time series navigation remains available.

## Source and data

Frontend HTML, scripts, styles, and map geometry were recovered from the public
Cloudflare site on 23 October 2026. These are deployed artifacts, not the
original build sources. No Cloudflare deployment was changed.

All generated budget amounts, demand names, source PDF paths, and quality
summaries come from the local clone `portal/` of
https://github.com/xKDR/india-public-finance-portal at commit
`371c1e5d79a7f2dfcb8d55f21867330384093910`, branch
`india-public-finance-dev-branch`.

`build-local-data.mjs` reads only repository additive-leaf NDJSON files and
demand dictionaries. It keeps the headline BE separate from the prior-year
restated BE and uses each state's native unit (100 lakh or 10,000 thousand
per crore). `prepare-preview.mjs` reads repository validation summaries.
The downloaded schema-index files are format references: only display labels
for hierarchy levels and sector groups are reused, not their monetary values.
The frontend fetches the locally generated JSON; it does not fetch hosted
Cloudflare budget data. Source PDF links point to the GitHub repository.

Rebuild with `node build-local-data.mjs`, then `node prepare-preview.mjs`.
Recovering the frontend afresh requires `node recover-frontend.mjs` and fetching
the map presentation asset again before preparation.

## Recovery limits

- This is a local navigation preview, not a complete replacement for the original
  publishing pipeline. Detailed quality flags inside account-head shards and
  sub-major/minor comparison search are not reconstructed.
- The repository's raw extraction differs from the live processed data in some
  historical fields, notably Tamil Nadu FY 2018-19 restated BE and RE. The local
  preview retains the repository values instead of copying live values.
- One malformed Karnataka row (`KA.2022-23.oh.v1.r2372`) has shifted account
  codes and an accounts amount above 10^22 lakh. It is excluded from preview
  calculations and preserved in full in `public-finance/data/excluded-rows.json`.
  Repository source files are unchanged. Thus the preview has one fewer leaf
  than the live site's published row count.
- Latest BE totals match the live displayed totals: Karnataka ₹447,992 crore,
  Tamil Nadu ₹404,388 crore. This is not a claim of historical data parity.
- Some ancillary home/guide assets and workflows may need recovery before
  publishing this copy. Use the States URL above for the requested preview.

## Verification

Both Explore buttons were followed from States in the browser and loaded the
corresponding state explorer. Site navigation contains States, Compare, Guide,
and About, with no separate Karnataka or Tamil Nadu links. A screenshot is
saved at `local-preview.png`.
