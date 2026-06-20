# Karnataka Validation Summary 2023-24

Budget rows: 17183
Rows by table type: object_head=17183
Validation check pass rate: 99.45% (11990/12056)

## Per-Volume Coverage

- 1: 3496 budget table rows
- 2: 3316 budget table rows
- 3: 2225 budget table rows
- 4: 2356 budget table rows
- 5: 3531 budget table rows
- 6: 944 budget table rows
- 7: 1315 budget table rows

## Worst Validation Rows

- KA.2023-24.expvol_3.in_schema.object_head.major.03_2401 W07 column 1: abs_diff=264764.33; source=353522.09; target=618286.42
- KA.2023-24.expvol_3.in_schema.object_head.major.03_2401 W07 column 2: abs_diff=264546.90; source=385379.56; target=649926.46
- KA.2023-24.expvol_3.in_schema.object_head.major.03_2401 W07 column 3: abs_diff=261800.15; source=283356.38; target=545156.53
- KA.2023-24.expvol_3.in_schema.object_head.major.03_2401 W07 column 4: abs_diff=210590.62; source=171526.44; target=382117.06
- KA.2023-24.expvol_5.in_schema.object_head.detailed.11_2235_02_197_6_na W06 column 4: abs_diff=161359.88; source=9215.20; target=170575.08
- KA.2023-24.expvol_4.in_schema.object_head.major.19_2217 W07 column 4: abs_diff=53100; source=238094.28; target=291194.28
- KA.2023-24.expvol_2.in_schema.object_head.major.17_2202 W07 column 4: abs_diff=41843; source=2940355.09; target=2982198.09
- KA.2023-24.expvol_2.in_schema.object_head.major.17_2202 W07 column 2: abs_diff=38385; source=2817480.14; target=2855865.14
- KA.2023-24.expvol_2.in_schema.object_head.major.17_2202 W07 column 3: abs_diff=36062.31; source=2845316.34; target=2881378.65
- KA.2023-24.expvol_3.in_schema.object_head.major.01_2402 W07 column 3: abs_diff=35936.98; source=1715.01; target=37651.99

## Caveats

- Amount unit is INR_lakh and remains source-unverified per volume.
- Generic Financial_Col_N years use the positional financial-column assumption documented in package caveats.
- The budget table is document-shaped: additive rows satisfy type_of_table='object_head', row_type='Data', and row_level='Object-Head'; total and summary rows repeat those amounts at higher levels.
- Within-schema checks anchor on printed Total rows; across-schema checks anchor on the target summary-table rows where those tables exist.
- 2016-17, 2017-18, and 2022-23 use recovered historical final summaries where needed.
