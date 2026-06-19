# Karnataka Validation Summary 2021-22

Budget rows: 21877
Rows by table type: minor_head=1804, object_head=19496, sub_major_head=577
Validation check pass rate: 89.88% (19787/22016)

## Per-Volume Coverage

- 1: 4604 budget table rows
- 2: 4013 budget table rows
- 3: 2827 budget table rows
- 4: 2820 budget table rows
- 5: 3860 budget table rows
- 6: 1461 budget table rows
- 7: 2292 budget table rows

## Worst Validation Rows

- KA.2021-22.expvol_1.in_schema.sub_major_head.sub_major.29_2049_60 W05 column 4: abs_diff=2716085; source=1; target=2716086
- KA.2021-22.expvol_2.in_schema.sub_major_head.sub_major.17_2202_80 W05 column 4: abs_diff=2629121.75; source=12796; target=2641917.75
- KA.2021-22.expvol_2.in_schema.sub_major_head.sub_major.17_2202_80 W05 column 2: abs_diff=2564333.07; source=13288; target=2577621.07
- KA.2021-22.expvol_2.in_schema.sub_major_head.sub_major.17_2202_80 W05 column 1: abs_diff=2494342.06; source=15726.74; target=2510068.80
- KA.2021-22.expvol_2.in_schema.sub_major_head.sub_major.17_2202_80 W05 column 3: abs_diff=2482442.55; source=12162.67; target=2494605.22
- KA.2021-22.expvol_1.in_schema.minor_head.sub_major.03_2071_01 W04 column 4: abs_diff=2335596; source=2335596; target=4671192
- KA.2021-22.expvol_1.across_schema.sub_major_head.sub_major.03_2071_01 A02 column 4: abs_diff=2335596; source=0; target=2335596
- KA.2021-22.expvol_1.across_schema.sub_major_head.sub_major.03_2071_01 A03 column 4: abs_diff=2335596; source=4671192; target=2335596
- KA.2021-22.expvol_1.across_schema.sub_major_head.sub_major.29_2049_01 A02 column 4: abs_diff=2313651; source=0; target=2313651
- KA.2021-22.expvol_1.in_schema.sub_major_head.sub_major.29_2049_60 W05 column 3: abs_diff=2261618; source=262; target=2261880

## Caveats

- Amount unit is INR_lakh and remains source-unverified per volume.
- Generic Financial_Col_N years use the positional financial-column assumption documented in package caveats.
- The budget table is document-shaped: additive rows satisfy type_of_table='object_head', row_type='Data', and row_level='Object-Head'; total and summary rows repeat those amounts at higher levels.
- Within-schema checks anchor on printed Total rows; across-schema checks anchor on the target summary-table rows where those tables exist.
- 2016-17, 2017-18, and 2022-23 use recovered historical final summaries where needed.
