# Karnataka Validation Summary 2022-23

Budget rows: 21081
Rows by table type: minor_head=1795, object_head=18703, sub_major_head=583
Validation check pass rate: 83.36% (16606/19920)

## Per-Volume Coverage

- 1: 4242 budget table rows
- 2: 3800 budget table rows
- 3: 2741 budget table rows
- 4: 2776 budget table rows
- 5: 4001 budget table rows
- 6: 1390 budget table rows
- 7: 2131 budget table rows

## Worst Validation Rows

- KA.2022-23.expvol_1.in_schema.sub_major_head.sub_major.29_2049_60 W05 column 4: abs_diff=2939456.55; source=4; target=2939460.55
- KA.2022-23.expvol_2.in_schema.sub_major_head.sub_major.17_2202_80 W05 column 4: abs_diff=2841102.05; source=14763.09; target=2855865.14
- KA.2022-23.expvol_1.in_schema.sub_major_head.sub_major.29_2049_60 W05 column 2: abs_diff=2716085; source=1; target=2716086
- KA.2022-23.expvol_1.in_schema.sub_major_head.sub_major.29_2049_60 W05 column 3: abs_diff=2715702.01; source=393.28; target=2716095.29
- KA.2022-23.expvol_2.in_schema.sub_major_head.sub_major.17_2202_80 W05 column 2: abs_diff=2629121.75; source=12796; target=2641917.75
- KA.2022-23.expvol_2.in_schema.sub_major_head.sub_major.17_2202_80 W05 column 3: abs_diff=2621535.75; source=13080.60; target=2634616.35
- KA.2022-23.expvol_1.across_schema.sub_major_head.sub_major.29_2049_01 A02 column 4: abs_diff=2571781.55; source=0; target=2571781.55
- KA.2022-23.expvol_2.in_schema.object_head.major.17_2202 W07 column 4: abs_diff=2485496.22; source=2853221.31; target=367725.09
- KA.2022-23.expvol_1.across_schema.minor_head.minor.29_2049_01_101 A01 column 4: abs_diff=2422636.55; source=0; target=2422636.55
- KA.2022-23.expvol_1.across_schema.sub_major_head.sub_major.03_2071_01 A02 column 4: abs_diff=2395668.74; source=0; target=2395668.74

## Caveats

- Amount unit is INR_lakh and remains source-unverified per volume.
- Generic Financial_Col_N years use the positional financial-column assumption documented in package caveats.
- The budget table is document-shaped: additive rows satisfy type_of_table='object_head', row_type='Data', and row_level='Object-Head'; total and summary rows repeat those amounts at higher levels.
- Within-schema checks anchor on printed Total rows; across-schema checks anchor on the target summary-table rows where those tables exist.
- 2016-17, 2017-18, and 2022-23 use recovered historical final summaries where needed.
