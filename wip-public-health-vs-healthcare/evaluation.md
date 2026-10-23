# Evaluation — Public Health vs Healthcare split for Karnataka

Evaluation of [`proposal.md`](proposal.md). Two things were checked against ground
truth, not taken on assertion:

1. **Paper fidelity** — Shah's actual IPF 2020 paper was downloaded and read
   ([`reference/shah-ncaer-ipf-2020.pdf`](reference/shah-ncaer-ipf-2020.pdf),
   text in `reference/shah-ncaer-ipf-2020.txt`). Page/line refs below are to the
   extracted text.
2. **Data claims** — every schema, version, count, and amount claim was checked
   against the repo data under `karnataka-state-finance/`.

## Verdict: GO, but restructure around the sub-major head

The conceptual core is sound and faithful to Shah. All data claims are exact. The
one change that matters most: the government's own chart of accounts already does
~80% of the split via `sub_major_head_code`. Lead with that as the backbone; use
keywords and the LLM only for the residue. The proposal currently leads with
keywords and buries the account structure as a few "priors" — that is backwards.

---

## 1. Paper fidelity (verified against the source)

**The core distinction is faithful.** Shah, p. 36-37: *"market failure in health has
a clean split between public health and health care... Public health is about
externalities and public goods... state interventions at the population level rather
than at the level of one individual at a time."* The proposal's
`public_health` = population/prevention/externalities vs `healthcare` = patient-level
treatment is exactly his split.

**The proposal correctly avoids the biggest trap.** Shah, p. 37: *"Health care and
primary health care are distinct from public health."* Most people reflexively file
"primary health care / PHC" under public health. The proposal puts PHCs under
`healthcare`. That is the subtle, correct call.

**"Classify at scheme level, then inherit to object-head rows" is the single most
important rule, and the proposal has it.** Object heads (`Pay-Officers`,
`Grants-in-Aid-Salaries`, `Dearness Allowance`) are funding instruments, not
functions. Classifying on them alone is the #1 failure mode.

**Separating `shared_admin` from `exclude` (recoveries/deductions) is correct
accounting.** Recoveries are contra entries; counting them as service spend would
double-distort.

### Gaps to fix (from the paper)

1. **Two of Shah's own public-health categories are missing.** He names them on
   p. 37: medical/scientific **research** and the health **statistical system /
   surveillance**. The `public_health` keywords have `surveillance` but not
   `research`, `statistics`, `survey`, `registration of births and deaths`,
   `health information`, `IDSP`. Medical-research institutes and the health MIS will
   leak into the wrong bucket. Add them.

2. **TB is misfiled.** The proposal puts `TB`/`chest diseases` under `healthcare`.
   But TB *control/elimination programs* (RNTCP/NTEP) are communicable-disease
   control with externalities, which is public health by Shah's own logic, exactly
   parallel to AIDS/HIV/NACO (correctly placed in public_health). The split is
   program-vs-facility: a TB *control program* is public health; a TB
   *hospital/sanatorium* is healthcare. Apply the same scheme-vs-facility rule used
   elsewhere.

3. **Shah's strongest validation anchor is unused.** p. 37: *"the expenditures
   involved in public health are relatively modest."* That is a citable prior for the
   expected result: the public-health share should come out **small** (likely
   single-to-low-double-digit percent). Use it as a sanity check. A 35-40% public
   health share would be a red flag (hospitals/PHCs leaking in), not a finding. State
   this prior in the paper.

## 2. Data verification (all claims confirmed)

Checked against `karnataka-state-finance/`:

| Claim | Status | Source |
|---|---|---|
| Columns `type_of_table`, `row_type`, `row_level`, `full_account_code` exist | ✓ exact | `karnataka-state-finance/data_dictionary.csv` |
| Values `object_head` / `Data` / `Object-Head` exist | ✓ exact | data_dictionary.csv |
| Release `v0.2.0-draft`, years 2016-17 to 2026-27 (11 years) | ✓ | `karnataka-state-finance/README.md` |
| 2210 leaf rows = 7,848 | ✓ exact | counted across 11 budget CSVs |
| 2211 leaf rows = 2,409 | ✓ exact | counted across 11 budget CSVs |
| 4210 leaf rows = 646 | ✓ exact | counted across 11 budget CSVs |
| 3435 / 5425 present | ✓ (398 / 7 leaf rows) | counted |
| Amounts in INR_lakh, 4 positional columns (accounts / BE restated / RE / BE current) | ✓ | data_dictionary.csv + CSV headers |

Leaf predicate used for counts:
`type_of_table='object_head' AND row_type='Data' AND row_level='Object-Head'`.

**No existing public-health-vs-healthcare classification exists in the repo.** The
current production code aggregates 2210+2211 as a single "Health" block, revenue-only,
4210 excluded (`examples/_spec/scope.json` → `"health_major_heads": ["2210","2211"]`;
`examples/src/python/01_health.py`). So the proposal's baseline universe matches the
existing scope, and the sub-split is net-new logic. Nothing fabricated.

## 3. The headline change: anchor on `sub_major_head_code`

The chart of accounts already separates the functions. Distinct sub-major heads under
2210 (from `karnataka-state-finance/years/2020-21/csv/budget_2020-21.csv`):

| Account segment | Map to | Why |
|---|---|---|
| `2210-01` Urban Health Services – Allopathy | **healthcare** | clinical delivery |
| `2210-02` Urban Health Services – Other systems (AYUSH) | **healthcare** | clinical delivery |
| `2210-03` Rural Health Services – Allopathy | **healthcare** | clinical delivery (PHC/CHC) |
| `2210-04` Rural Health Services – Other systems | **healthcare** | clinical delivery |
| `2210-05` Medical Education, Training & Research | **healthcare**, carve out *Research* → public_health | training clinicians = HC; research = PH (Shah) |
| `2210-06` Public Health | **public_health** (default) | the state's own public-health bucket; matches Shah |
| `2210-80` General | **shared_admin** | directorate / cross-cutting |
| `2211-00` Family Welfare | **split by minor head / scheme** | immunization + family planning = PH; RCH / maternal-child clinical = HC |

The proposal's account priors `2210-06-101`, `2210-06-112` both sit inside sub-major
06, so they are structurally consistent — but they are a few examples of a column that
should be the *primary axis*.

This collapses the 7-agent sweep into: deterministic sub-major mapping → keyword
refinement on just sub-major 05 + 2211 → small LLM residual for stray disease-control
programs parked under a health-services sub-major. Cheaper, and far more defensible in
the paper because the primary axis is the state's own functional taxonomy.

## 4. Data-driven cautions

- **Classify on codes, not name strings.** The data shows
  `Urban Health Services- Other systems of medicine` spelled three ways across rows.
  Names drift year to year; `sub_major_head_code` / `full_account_code` do not.
- **Many 2210 object-head rows are per-district replications** (object codes 401-467)
  of the same scheme. This is exactly why "classify at scheme level, then inherit"
  matters — and why you should classify the **distinct account-code set once** and
  join back to all years, not LLM-label all ~10,900 rows. Cuts LLM cost ~10x and makes
  inter-year consistency hold by construction.
- **Weight validation by rupees, not rows.** A misclassified ₹2,000 cr hospital line
  dwarfs 50 misclassified ₹2-lakh lines. Sample, error rates, and audit should be
  amount-weighted. Report Cohen's kappa separately for high-amount rows.

## 5. Smaller fixes

- **Lock the precedence stack:** (1) account-code prior (sub-major / minor head) →
  (2) scheme-level keyword → (3) object-head keyword as tie-break only → (4) LLM for
  residual/conflict/high-value. The proposal lists the inputs but does not order them.
- **Reconcile the admin tension.** "Keep admin separate" and "inherit function from
  parent scheme" pull against each other. Resolve: assign admin to a function when its
  parent minor head is functionally pure; only genuinely cross-cutting directorate
  admin (2210-80 General) goes to the shared bucket. Shrinks the unallocated pile.
- **2211 needs splitting, not lumping.** The universe writeup reads as if 2211 is one
  block. Family Welfare contains both immunization/family planning (PH) and
  maternal-child clinical (HC). Keywords cover it; make the universe text explicit.
- **Capital symmetry.** If you appendix 4210, appendix 4211 (Capital Outlay on Family
  Welfare) too.
- **External validity.** Benchmark the public-health share against National Health
  Accounts (NHA) and 15th Finance Commission health figures where comparable.

## Open items for the next session

- Confirm KA uses the standard sub-major structure in *all 11 years* (checked 2020-21
  only here); watch for years where sub-major codes are blank or renamed.
- Decide the Medical Education vs Research carve-out rule inside `2210-05` (minor-head
  or scheme keyword).
- Decide the 2211 minor-head → PH/HC mapping (the one place keywords genuinely carry
  the load).
- Pin the exact data version hash for the replication package.
