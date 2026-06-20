# Karnataka Validation Summary 2018-19

Budget rows: 22138
Rows by table type: minor_head=1707, object_head=19892, sub_major_head=539
Validation check pass rate: 86.78% (17998/20740)

## Per-Volume Coverage

- 1: 4341 budget table rows
- 2: 4164 budget table rows
- 3: 3151 budget table rows
- 4: 2733 budget table rows
- 5: 3827 budget table rows
- 6: 1575 budget table rows
- 7: 2347 budget table rows

## Worst Validation Rows

- KA.2018-19.expvol_1.in_schema.minor_head.sub_major.03_2071_01 W04 column 4: abs_diff=2470135; source=480087; target=2950222
- KA.2018-19.expvol_1.in_schema.minor_head.sub_major.03_2071_01 W04 column 2: abs_diff=2150518; source=477022; target=2627540
- KA.2018-19.expvol_1.in_schema.minor_head.sub_major.03_2071_01 W04 column 3: abs_diff=1979058; source=424278; target=2403336
- KA.2018-19.expvol_1.in_schema.minor_head.sub_major.03_2071_01 W04 column 1: abs_diff=1826663.74; source=427036.34; target=2253700.08
- KA.2018-19.expvol_2.across_schema.sub_major_head.sub_major.17_2202_01 A02 column 4: abs_diff=1594498; source=0; target=1594498
- KA.2018-19.expvol_1.across_schema.sub_major_head.sub_major.03_2071_01 A03 column 4: abs_diff=1475241; source=2950222; target=1474981
- KA.2018-19.expvol_1.across_schema.sub_major_head.sub_major.03_2071_01 A02 column 4: abs_diff=1474981; source=0; target=1474981
- KA.2018-19.expvol_1.across_schema.sub_major_head.sub_major.03_2071_01 A03 column 2: abs_diff=1313800; source=2627540; target=1313740
- KA.2018-19.expvol_1.across_schema.sub_major_head.sub_major.03_2071_01 A02 column 2: abs_diff=1313740; source=0; target=1313740
- KA.2018-19.expvol_1.across_schema.sub_major_head.sub_major.29_2049_01 A02 column 4: abs_diff=1286459; source=0; target=1286459

## Caveats

- Amount unit is INR_lakh and remains source-unverified per volume.
- Generic Financial_Col_N years use the positional financial-column assumption documented in package caveats.
- The budget table is document-shaped: additive rows satisfy type_of_table='object_head', row_type='Data', and row_level='Object-Head'; total and summary rows repeat those amounts at higher levels.
- Within-schema checks anchor on printed Total rows; across-schema checks anchor on the target summary-table rows where those tables exist.
- 2016-17, 2017-18, and 2022-23 use recovered historical final summaries where needed.
