# Karnataka Validation Summary 2026-27

Budget rows: 17014
Rows by table type: object_head=17014
Validation check pass rate: 99.68% (11830/11868)

## Per-Volume Coverage

- 1: 3933 budget table rows
- 2: 3104 budget table rows
- 3: 2178 budget table rows
- 4: 2505 budget table rows
- 5: 3541 budget table rows
- 6: 791 budget table rows
- 7: 962 budget table rows

## Worst Validation Rows

- KA.2026-27.expvol_1.in_schema.object_head.major.29_6003 W07 column 2: abs_diff=90000; source=2538490; target=2448490
- KA.2026-27.expvol_1.in_schema.object_head.major.29_6003 W07 column 3: abs_diff=90000; source=2538490; target=2448490
- KA.2026-27.expvol_2.in_schema.object_head.detailed.22_2211_00_196_6_04 W06 column 2: abs_diff=7131.63; source=630.11; target=7761.74
- KA.2026-27.expvol_2.in_schema.object_head.detailed.22_2211_00_196_6_04 W06 column 3: abs_diff=7131.63; source=630.11; target=7761.74
- KA.2026-27.expvol_2.in_schema.object_head.detailed.22_2211_00_196_6_04 W06 column 4: abs_diff=6932.10; source=624.81; target=7556.91
- KA.2026-27.expvol_2.in_schema.object_head.detailed.22_2211_00_196_6_04 W06 column 1: abs_diff=6671.58; source=525.81; target=7197.39
- KA.2026-27.expvol_5.in_schema.object_head.detailed.23_2230_01_101_0_04 W06 column 4: abs_diff=5542.71; source=531.05; target=6073.76
- KA.2026-27.expvol_5.in_schema.object_head.detailed.23_2230_01_101_0_04 W06 column 2: abs_diff=5309.15; source=488.87; target=5798.02
- KA.2026-27.expvol_5.in_schema.object_head.detailed.23_2230_01_101_0_04 W06 column 3: abs_diff=5309.15; source=488.87; target=5798.02
- KA.2026-27.expvol_3.in_schema.object_head.major.01_2402 W07 column 4: abs_diff=4870; source=2155.75; target=7025.75

## Caveats

- Amount unit is INR_lakh and remains source-unverified per volume.
- Generic Financial_Col_N years use the positional financial-column assumption documented in package caveats.
- The budget table is document-shaped: additive rows satisfy type_of_table='object_head', row_type='Data', and row_level='Object-Head'; total and summary rows repeat those amounts at higher levels.
- Within-schema checks anchor on printed Total rows; across-schema checks anchor on the target summary-table rows where those tables exist.
- 2016-17, 2017-18, and 2022-23 use recovered historical final summaries where needed.
