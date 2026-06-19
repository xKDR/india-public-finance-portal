# Karnataka Validation Summary 2017-18

Budget rows: 22127
Rows by table type: minor_head=1749, object_head=19792, sub_major_head=586
Validation check pass rate: 74.83% (14322/19140)

## Per-Volume Coverage

- 1: 4078 budget table rows
- 2: 4331 budget table rows
- 3: 2924 budget table rows
- 4: 3057 budget table rows
- 5: 3880 budget table rows
- 6: 1475 budget table rows
- 7: 2382 budget table rows

## Worst Validation Rows

- KA.2017-18.expvol_2.in_schema.object_head.major.12_2220 W07 column 4: abs_diff=24212222060106004038968.41259; source=24212222060106004046517.41259; target=7549
- KA.2017-18.expvol_2.in_schema.object_head.sub_major.17_2202_80 W02 column 3: abs_diff=1563545.08; source=24027.40; target=1587572.48
- KA.2017-18.expvol_2.across_schema.sub_major_head.sub_major.17_2202_80 A02 column 3: abs_diff=1561501.67; source=1587572.48; target=26070.81
- KA.2017-18.expvol_2.in_schema.object_head.sub_major.17_2202_80 W02 column 2: abs_diff=1488144.69; source=17770.31; target=1505915
- KA.2017-18.expvol_2.across_schema.sub_major_head.sub_major.17_2202_80 A02 column 2: abs_diff=1487229; source=1505915; target=18686
- KA.2017-18.expvol_2.across_schema.sub_major_head.sub_major.17_2202_80 A02 column 4: abs_diff=1473310; source=1504408; target=31098
- KA.2017-18.expvol_2.in_schema.object_head.sub_major.17_2202_80 W02 column 4: abs_diff=1472616; source=31792; target=1504408
- KA.2017-18.expvol_2.in_schema.object_head.sub_major.17_2202_80 W02 column 1: abs_diff=1472488.19; source=30309.72; target=1502797.91
- KA.2017-18.expvol_2.across_schema.sub_major_head.sub_major.17_2202_80 A02 column 1: abs_diff=1471804.30; source=1502797.91; target=30993.61
- KA.2017-18.expvol_1.in_schema.object_head.major.29_2049 W07 column 4: abs_diff=1338280; source=1338280; target=0

## Caveats

- Amount unit is INR_lakh and remains source-unverified per volume.
- Generic Financial_Col_N years use the positional financial-column assumption documented in package caveats.
- The budget table is document-shaped: additive rows satisfy type_of_table='object_head', row_type='Data', and row_level='Object-Head'; total and summary rows repeat those amounts at higher levels.
- Within-schema checks anchor on printed Total rows; across-schema checks anchor on the target summary-table rows where those tables exist.
- 2016-17, 2017-18, and 2022-23 use recovered historical final summaries where needed.
