# Karnataka Validation Summary 2020-21

Budget rows: 22090
Rows by table type: minor_head=1848, object_head=19689, sub_major_head=553
Validation check pass rate: 89.55% (19632/21924)

## Per-Volume Coverage

- 1: 4292 budget table rows
- 2: 4222 budget table rows
- 3: 2996 budget table rows
- 4: 2996 budget table rows
- 5: 3891 budget table rows
- 6: 1294 budget table rows
- 7: 2399 budget table rows

## Worst Validation Rows

- KA.2020-21.expvol_2.in_schema.sub_major_head.sub_major.17_2202_80 W05 column 4: abs_diff=2564333.07; source=13288; target=2577621.07
- KA.2020-21.expvol_2.in_schema.sub_major_head.sub_major.17_2202_80 W05 column 3: abs_diff=2535168.04; source=16135.65; target=2551303.69
- KA.2020-21.expvol_2.in_schema.sub_major_head.sub_major.17_2202_80 W05 column 2: abs_diff=2492591.62; source=16111.21; target=2508702.83
- KA.2020-21.expvol_1.in_schema.sub_major_head.sub_major.29_2049_60 W05 column 4: abs_diff=2221639; source=0; target=2221639
- KA.2020-21.expvol_1.across_schema.sub_major_head.sub_major.03_2071_01 A02 column 4: abs_diff=2215440; source=0; target=2215440
- KA.2020-21.expvol_2.in_schema.sub_major_head.sub_major.17_2202_80 W05 column 1: abs_diff=2185927.54; source=18408.34; target=2204335.88
- KA.2020-21.expvol_1.across_schema.sub_major_head.sub_major.03_2071_01 A02 column 3: abs_diff=1951307; source=0; target=1951307
- KA.2020-21.expvol_1.across_schema.sub_major_head.sub_major.03_2071_01 A02 column 2: abs_diff=1917784; source=0; target=1917784
- KA.2020-21.expvol_1.in_schema.sub_major_head.sub_major.29_2049_60 W05 column 2: abs_diff=1906030; source=1; target=1906031
- KA.2020-21.expvol_1.in_schema.sub_major_head.sub_major.29_2049_60 W05 column 3: abs_diff=1863799.55; source=305.83; target=1864105.38

## Caveats

- Amount unit is INR_lakh and remains source-unverified per volume.
- Generic Financial_Col_N years use the positional financial-column assumption documented in package caveats.
- The budget table is document-shaped: additive rows satisfy type_of_table='object_head', row_type='Data', and row_level='Object-Head'; total and summary rows repeat those amounts at higher levels.
- Within-schema checks anchor on printed Total rows; across-schema checks anchor on the target summary-table rows where those tables exist.
- 2016-17, 2017-18, and 2022-23 use recovered historical final summaries where needed.
