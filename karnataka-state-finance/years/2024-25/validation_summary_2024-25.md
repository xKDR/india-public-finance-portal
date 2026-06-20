# Karnataka Validation Summary 2024-25

Budget rows: 16389
Rows by table type: object_head=16389
Validation check pass rate: 99.00% (11745/11864)

## Per-Volume Coverage

- 1: 3496 budget table rows
- 2: 3205 budget table rows
- 3: 1989 budget table rows
- 4: 2233 budget table rows
- 5: 3423 budget table rows
- 6: 811 budget table rows
- 7: 1232 budget table rows

## Worst Validation Rows

- KA.2024-25.expvol_5.in_schema.object_head.major.11_2225 W07 column 4: abs_diff=376136.85; source=5000; target=381136.85
- KA.2024-25.expvol_5.in_schema.object_head.major.11_2225 W07 column 1: abs_diff=356002.82; source=1292.25; target=357295.07
- KA.2024-25.expvol_5.in_schema.object_head.major.11_2225 W07 column 3: abs_diff=332089.76; source=-10785.71; target=321304.05
- KA.2024-25.expvol_5.in_schema.object_head.major.11_2225 W07 column 2: abs_diff=309669.41; source=-10785.71; target=298883.70
- KA.2024-25.expvol_5.in_schema.object_head.major.10_2225 W07 column 4: abs_diff=304895.39; source=936086.49; target=631191.10
- KA.2024-25.expvol_3.in_schema.object_head.major.01_2401 W07 column 1: abs_diff=281828.02; source=241164.77; target=522992.79
- KA.2024-25.expvol_3.in_schema.object_head.major.03_2401 W07 column 1: abs_diff=281828.02; source=406691.13; target=124863.11
- KA.2024-25.expvol_5.in_schema.object_head.major.10_2225 W07 column 1: abs_diff=275646.62; source=769894.05; target=494247.43
- KA.2024-25.expvol_5.in_schema.object_head.major.10_2225 W07 column 3: abs_diff=268256.44; source=808255.81; target=539999.37
- KA.2024-25.expvol_5.in_schema.object_head.major.10_2225 W07 column 2: abs_diff=261263.96; source=807161.60; target=545897.64

## Caveats

- Amount unit is INR_lakh and remains source-unverified per volume.
- Generic Financial_Col_N years use the positional financial-column assumption documented in package caveats.
- The budget table is document-shaped: additive rows satisfy type_of_table='object_head', row_type='Data', and row_level='Object-Head'; total and summary rows repeat those amounts at higher levels.
- Within-schema checks anchor on printed Total rows; across-schema checks anchor on the target summary-table rows where those tables exist.
- 2016-17, 2017-18, and 2022-23 use recovered historical final summaries where needed.
