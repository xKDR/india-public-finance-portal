# Karnataka Validation Summary 2019-20

Budget rows: 21949
Rows by table type: minor_head=1768, object_head=19638, sub_major_head=543
Validation check pass rate: 89.53% (19206/21452)

## Per-Volume Coverage

- 1: 4331 budget table rows
- 2: 4270 budget table rows
- 3: 3109 budget table rows
- 4: 2773 budget table rows
- 5: 3788 budget table rows
- 6: 1433 budget table rows
- 7: 2245 budget table rows

## Worst Validation Rows

- KA.2019-20.expvol_2.in_schema.sub_major_head.sub_major.17_2202_80 W05 column 4: abs_diff=2492591.62; source=16111.21; target=2508702.83
- KA.2019-20.expvol_2.in_schema.sub_major_head.sub_major.17_2202_80 W05 column 2: abs_diff=2357839; source=18260; target=2376099
- KA.2019-20.expvol_2.in_schema.sub_major_head.sub_major.17_2202_80 W05 column 3: abs_diff=2344712.74; source=17682.92; target=2362395.66
- KA.2019-20.expvol_2.in_schema.sub_major_head.sub_major.17_2202_80 W05 column 1: abs_diff=1968346.68; source=18349.12; target=1986695.80
- KA.2019-20.expvol_1.in_schema.minor_head.sub_major.03_2071_01 W04 column 4: abs_diff=1917784; source=1917784; target=3835568
- KA.2019-20.expvol_1.across_schema.sub_major_head.sub_major.03_2071_01 A02 column 4: abs_diff=1917784; source=0; target=1917784
- KA.2019-20.expvol_1.across_schema.sub_major_head.sub_major.03_2071_01 A03 column 4: abs_diff=1917784; source=3835568; target=1917784
- KA.2019-20.expvol_1.in_schema.sub_major_head.sub_major.29_2049_60 W05 column 4: abs_diff=1906030; source=1; target=1906031
- KA.2019-20.expvol_1.in_schema.minor_head.sub_major.03_2071_01 W04 column 2: abs_diff=1774320; source=1774320; target=3548640
- KA.2019-20.expvol_1.across_schema.sub_major_head.sub_major.03_2071_01 A02 column 2: abs_diff=1774320; source=0; target=1774320

## Caveats

- Amount unit is INR_lakh and remains source-unverified per volume.
- Generic Financial_Col_N years use the positional financial-column assumption documented in package caveats.
- The budget table is document-shaped: additive rows satisfy type_of_table='object_head', row_type='Data', and row_level='Object-Head'; total and summary rows repeat those amounts at higher levels.
- Within-schema checks anchor on printed Total rows; across-schema checks anchor on the target summary-table rows where those tables exist.
- 2016-17, 2017-18, and 2022-23 use recovered historical final summaries where needed.
