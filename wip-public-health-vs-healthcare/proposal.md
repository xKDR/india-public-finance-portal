# Proposal — Public Health vs Healthcare split for Karnataka

> Original multi-agent proposal, saved verbatim. Authored with: 5.4-mini xhigh for
> the NCAER/IPF paper, 5.3-codex-spark for narrow Karnataka data sweeps, main 5.5
> xhigh thread for synthesis and review.

## Core Identification Strategy

Use Shah's functional distinction from the [NCAER paper](https://ncaer.org/wp-content/uploads/2022/09/Indian-Health-Policy-in-Light-of-COVID-19_The-puzzle-of-state-of-state-capacity-and-institututional-design-India-Policy-Forum-2020-Vol_-17-54-98-Ajay-Shah.pdf):
public health is population-level prevention, surveillance, externalities, and state
capacity; healthcare is patient-level treatment, facilities, staff, drugs, hospitals,
insurance, and clinical delivery.

For Karnataka, classify additive object-head rows only:

`type_of_table='object_head' AND row_type='Data' AND row_level='Object-Head'`

Baseline universe:
- `2210` Medical and Public Health: 7,848 rows
- `2211` Family Welfare: 2,409 rows
- Optional capital appendix: `4210` Capital Outlay on Medical and Public Health, 646 rows
- Exclude or appendix-only: `3435`, `5425` medical waste/environment rows

## Keyword Proposal

`public_health`
- Strong account priors: `2210-06-101`, `2210-06-112`, `2211-00-108`
- Keywords: `prevention`, `control of diseases`, `public health education`, `health education`, `surveillance`, `epidemic`, `vector borne`, `malaria`, `guinea worm`, `eradication`, `AIDS`, `HIV`, `NACO`, `immun*`, `vaccine`, `population`, `sanitation`, `water pollution`, `air pollution`, `medical waste`
- Examples found: Anti-Malaria Programme, Guinea Worm Eradication, AIDS Prevention Society, Public Health Education, India Population Project

`healthcare`
- Strong account priors: hospitals/dispensaries, medical education, rural/urban health service delivery, PHCs as service units
- Keywords: `hospital`, `dispensary`, `PHC`, `CHC`, `clinic`, `medical college`, `medical education`, `trauma`, `orthopaed`, `super speciality`, `ambulance`, `diagnostic`, `mental health`, `psychiatric`, `TB`, `chest diseases`, `maternity`, `child health`, `women health care`, `medical stores`, `drug control`, `insurance`, `reimbursement`
- Examples found: Hospitals Attached to Teaching Institutions, Sanjay Gandhi Institute of Trauma, Rajiv Gandhi Super Speciality Hospital, Government Homeopathy Medical College with Hospital, Rural Family Health Centres in PHCs

`shared_admin_or_ambiguous`
- Keywords: `Direction and Administration`, `Directorate`, `Bureau`, `Transport Organisation`, `Pay-Officers`, `Pay-Staff`, `Dearness Allowance`, `General Expenses`, `Travel Expenses`, `Outsource`, `Vacant Post Provision`
- Baseline treatment: keep as separate shared/admin bucket.
- Paper treatment: show direct split excluding admin, then robustness with admin allocated pro-rata within year/account family.

`exclude_or_accounting`
- Keywords: `Deduct`, `Recoveries`, `Recovery`, `Inter Account Transfers`, `Overpayments`
- Do not count these as service spending unless explicitly analyzing gross book entries.

Important review point: do not classify using object-head terms alone. `Pay-Officers`
or `Grants-in-Aid-Salaries` can support either public health or healthcare depending on
the parent scheme. Label at the most specific stable scheme level, then inherit to
object-head rows.

## Agentic Workflow

Use agents for discovery and quality control, not final judgment.

1. Inventory agent: locate release files, schemas, additive filters, years, and amount columns.
2. Theory agent: read Shah/IPF paper and produce classification implications.
3. Keyword sweep agents: one per major head or slice: `2210`, `2211`, `demand 22 outside 2210/2211`, optional all-budget environmental-health sweep.
4. Rule-builder agent: convert discovered terms into regex/codebook rules with precedence.
5. LLM API classifier: only for rows where rules conflict, no rule fires, or the row is high-value by amount.
6. Auditor agent: check year-to-year stability by `full_account_code`, detect label flips, and surface top-amount ambiguous rows.
7. Main 5.5 xhigh reviewer: approve final codebook, decide ambiguous conventions, and sign off on paper tables.

LLM API call should return strict JSON:

```json
{
  "label": "public_health | healthcare | shared_admin | exclude | uncertain",
  "confidence": 0.0,
  "evidence_terms": [],
  "decision_rule": "short rule id",
  "rationale": "one sentence"
}
```

Use temperature 0, compact row context, and require the model to cite only fields
present in the row.

## Paper Path

1. State research question: "What share of Karnataka health spending is public health versus healthcare?"
2. Define conceptual split using Shah: population/public-good prevention vs patient-level care.
3. Define data: Karnataka release `v0.2.0-draft`, years 2016-17 to 2026-27, additive object-head rows, row-level provenance.
4. Define baseline universe: `2210 + 2211`; report `4210` capital separately.
5. Publish codebook: account-code priors, keyword rules, admin/exclusion rules, LLM adjudication protocol.
6. Validate: hand-code stratified sample, oversample high-amount and ambiguous rows, report agreement and error rates.
7. Estimate: yearly public-health share, healthcare share, admin share, optional capital-inclusive share.
8. Robustness: include/exclude `4210`; allocate admin pro-rata; high-confidence-only rows; rules-only vs LLM-assisted classification.
9. Release replication package: input version, scripts, codebook, classified row file, audit sample, and tables.
