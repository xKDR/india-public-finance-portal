# Karnataka Validation Summary 2025-26

Budget rows: 16260
Rows by table type: object_head=16260
Validation check pass rate: 99.62% (11823/11868)

## Per-Volume Coverage

- 1: 3927 budget table rows
- 2: 2858 budget table rows
- 3: 2020 budget table rows
- 4: 2427 budget table rows
- 5: 3263 budget table rows
- 6: 778 budget table rows
- 7: 987 budget table rows

## Worst Validation Rows

- KA.2025-26.expvol_1.in_schema.object_head.major.29_2049 W07 column 4: abs_diff=99930; source=4460094.20; target=4560024.20
- KA.2025-26.expvol_1.in_schema.object_head.major.29_2049 W07 column 1: abs_diff=91900; source=2990731.83; target=3082631.83
- KA.2025-26.expvol_1.in_schema.object_head.major.29_2049 W07 column 2: abs_diff=91900; source=3831453.70; target=3923353.70
- KA.2025-26.expvol_1.in_schema.object_head.major.29_2049 W07 column 3: abs_diff=91900; source=3571453.85; target=3663353.85
- KA.2025-26.expvol_2.in_schema.object_head.detailed.17_2202_01_196_1_na W06 column 2: abs_diff=88349.34; source=3925.17; target=92274.51
- KA.2025-26.expvol_2.in_schema.object_head.detailed.17_2202_01_196_1_na W06 column 3: abs_diff=88349.34; source=3925.17; target=92274.51
- KA.2025-26.expvol_2.in_schema.object_head.detailed.17_2202_01_196_1_na W06 column 1: abs_diff=78823.65; source=3925.12; target=82748.77
- KA.2025-26.expvol_2.in_schema.object_head.detailed.17_2202_01_196_1_na W06 column 4: abs_diff=76564.50; source=2951.61; target=79516.11
- KA.2025-26.expvol_2.in_schema.object_head.detailed.22_2211_00_196_6_na W06 column 4: abs_diff=16168.44; source=1547.59; target=17716.03
- KA.2025-26.expvol_2.in_schema.object_head.detailed.22_2211_00_196_6_na W06 column 3: abs_diff=15525.57; source=1489.71; target=17015.28

## Caveats

- Amount unit is INR_lakh and remains source-unverified per volume.
- Generic Financial_Col_N years use the positional financial-column assumption documented in package caveats.
- The budget table is document-shaped: additive rows satisfy type_of_table='object_head', row_type='Data', and row_level='Object-Head'; total and summary rows repeat those amounts at higher levels.
- Within-schema checks anchor on printed Total rows; across-schema checks anchor on the target summary-table rows where those tables exist.
- 2016-17, 2017-18, and 2022-23 use recovered historical final summaries where needed.
