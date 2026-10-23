# WIP — Public Health vs Healthcare split (Karnataka)

**Status: work in progress. Proposal and evaluation only. No classifier built yet.**

A new analysis application: split Karnataka government health spending into
"public health" (population-level prevention, surveillance, externalities) vs
"healthcare" (patient-level clinical delivery), using Ajay Shah's functional
distinction from the IPF 2020 paper. Research question: *what share of Karnataka
health spending is public health versus healthcare?*

This sits alongside the existing `examples/` health analysis, which currently treats
2210 + 2211 as a single "Health" aggregate. This work adds the sub-split that does not
exist yet in the repo.

## Files

| File | What it is |
|---|---|
| [`proposal.md`](proposal.md) | The original multi-agent proposal, verbatim. |
| [`evaluation.md`](evaluation.md) | Evaluation: paper fidelity (verified against source), data claims (all confirmed), and the recommended restructure. |
| `reference/shah-ncaer-ipf-2020.pdf` | Shah, IPF 2020. Source for the conceptual split. Downloaded from [ncaer.org](https://ncaer.org/wp-content/uploads/2022/09/Indian-Health-Policy-in-Light-of-COVID-19_The-puzzle-of-state-of-state-capacity-and-institututional-design-India-Policy-Forum-2020-Vol_-17-54-98-Ajay-Shah.pdf). |
| `reference/shah-ncaer-ipf-2020.txt` | Extracted text of the paper (page/line refs in evaluation.md point here). |

## Where it stands

- Conceptual approach: sound, faithful to Shah. **GO.**
- Data claims: all verified exact (schema, `v0.2.0-draft`, row counts 7,848 / 2,409 / 646, INR_lakh amounts).
- No classifier built yet. This folder is spec + evaluation only.

## Biggest decision already made

Lead the classifier with `sub_major_head_code` (the state's own functional taxonomy
already separates Public Health, the health-services sub-majors, Medical Education, and
General), then refine with keywords and an LLM residual. See `evaluation.md` §3.

## Next session

Open items are listed at the bottom of `evaluation.md`. Shortest path to a first
estimate: build the deterministic sub-major → {public_health, healthcare,
shared_admin} mapping over the distinct `full_account_code` set, join to all 11 years,
and report the rupee-weighted share before adding any keyword/LLM layer.
