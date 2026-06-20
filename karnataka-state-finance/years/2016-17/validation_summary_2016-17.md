# Karnataka Validation Summary 2016-17

Budget rows: 22103
Rows by table type: minor_head=1864, object_head=19660, sub_major_head=579
Validation check pass rate: 84.32% (16826/19956)

## Per-Volume Coverage

- 1: 3925 budget table rows
- 2: 4163 budget table rows
- 3: 2960 budget table rows
- 4: 3406 budget table rows
- 5: 3482 budget table rows
- 6: 1539 budget table rows
- 7: 2628 budget table rows

## Worst Validation Rows

- KA.2016-17.expvol_5.in_schema.object_head.minor.23_2230_03_101 W01 column 1: abs_diff=2365231344.58; source=2365253527.91; target=22183.33
- KA.2016-17.expvol_2.in_schema.object_head.minor.17_2202_03_102 W01 column 1: abs_diff=952171992.28; source=952229365.45; target=57373.17
- KA.2016-17.expvol_4.in_schema.object_head.minor.19_3604_00_193 W01 column 4: abs_diff=2220131.15; source=2246055.54; target=25924.39
- KA.2016-17.expvol_1.across_schema.sub_major_head.sub_major.03_2071_01 A02 column 4: abs_diff=1208160; source=0; target=1208160
- KA.2016-17.expvol_1.across_schema.sub_major_head.sub_major.03_2071_01 A02 column 3: abs_diff=1110134; source=0; target=1110134
- KA.2016-17.expvol_1.across_schema.sub_major_head.sub_major.03_2071_01 A02 column 2: abs_diff=1067594; source=0; target=1067594
- KA.2016-17.expvol_1.across_schema.sub_major_head.sub_major.03_2071_01 A02 column 1: abs_diff=1010118.01; source=0; target=1010118.01
- KA.2016-17.expvol_1.across_schema.sub_major_head.sub_major.29_2049_01 A02 column 4: abs_diff=994812; source=0; target=994812
- KA.2016-17.expvol_2.across_schema.sub_major_head.sub_major.17_2202_01 A02 column 4: abs_diff=984342; source=0; target=984342
- KA.2016-17.expvol_2.across_schema.sub_major_head.sub_major.17_2202_01 A02 column 2: abs_diff=948156; source=0; target=948156

## Caveats

- Amount unit is INR_lakh and remains source-unverified per volume.
- Generic Financial_Col_N years use the positional financial-column assumption documented in package caveats.
- The budget table is document-shaped: additive rows satisfy type_of_table='object_head', row_type='Data', and row_level='Object-Head'; total and summary rows repeat those amounts at higher levels.
- Within-schema checks anchor on printed Total rows; across-schema checks anchor on the target summary-table rows where those tables exist.
- 2016-17, 2017-18, and 2022-23 use recovered historical final summaries where needed.
