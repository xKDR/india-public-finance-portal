-- 02_committed.sql — Q2: Committed expenditure (salaries + pensions + interest)
--
-- Scope constants from examples/_spec/scope.json:
--   pension_major_head    : "2071"
--   interest_major_head   : "2049"
--   salary_object_codes   : ["001","002","003","004","005","008","009","011","014","020","033","035"]
--
-- Priority rule (matches the canonical build script):
--   1. Rows in major_head 2071 count as PENSIONS (highest priority).
--   2. Rows in major_head 2049 count as INTEREST.
--   3. Rows whose object_head_code is in the salary list AND NOT in the above
--      two major heads count as SALARIES.
--   (A row cannot be double-counted across categories.)
--
-- The tidy CSV is already additive-leaf, canonical-source, OCR-cleaned.
-- Amounts in INR lakh; divide by 100 for INR crore.
--
-- This file has 2 SECTION queries, parsed by run_sql.py using "-- SECTION:" markers.

-- SECTION: q2_committed
-- Committed expenditure components as Actuals, by fiscal year.
WITH raw AS (
    SELECT
        fiscal_year,
        SUM(CASE
            WHEN measure = 'Actuals'
             AND major_head_code NOT IN ('2071', '2049')
             AND object_head_code IN (
                 '001','002','003','004','005','008','009',
                 '011','014','020','033','035'
             )
            THEN amount_lakh ELSE 0
        END) AS sal_lakh,
        SUM(CASE
            WHEN measure = 'Actuals' AND major_head_code = '2071'
            THEN amount_lakh ELSE 0
        END) AS pen_lakh,
        SUM(CASE
            WHEN measure = 'Actuals' AND major_head_code = '2049'
            THEN amount_lakh ELSE 0
        END) AS int_lakh,
        SUM(CASE
            WHEN measure = 'Actuals'
            THEN amount_lakh ELSE 0
        END) AS total_lakh
    FROM read_csv_auto('{CSV_PATH}')
    GROUP BY fiscal_year
    HAVING SUM(CASE WHEN measure = 'Actuals' THEN amount_lakh ELSE 0 END) != 0
)
SELECT
    fiscal_year,
    ROUND(sal_lakh / 100.0, 2)                              AS salaries,
    ROUND(pen_lakh / 100.0, 2)                              AS pensions,
    ROUND(int_lakh / 100.0, 2)                              AS interest,
    ROUND((sal_lakh + pen_lakh + int_lakh) / 100.0, 2)      AS committed,
    ROUND(total_lakh / 100.0, 2)                             AS total_exp_actuals,
    ROUND(100.0 * (sal_lakh + pen_lakh + int_lakh) / total_lakh, 2) AS share_pct
FROM raw
ORDER BY fiscal_year;

-- SECTION: total_expenditure
-- Total BE and committed BE by fiscal year (context for budget planning).
-- Same priority rule as above, but using BE instead of Actuals.
WITH raw_be AS (
    SELECT
        fiscal_year,
        SUM(CASE
            WHEN measure = 'BE'
             AND major_head_code NOT IN ('2071', '2049')
             AND object_head_code IN (
                 '001','002','003','004','005','008','009',
                 '011','014','020','033','035'
             )
            THEN amount_lakh ELSE 0
        END) AS sal_be_lakh,
        SUM(CASE
            WHEN measure = 'BE' AND major_head_code = '2071'
            THEN amount_lakh ELSE 0
        END) AS pen_be_lakh,
        SUM(CASE
            WHEN measure = 'BE' AND major_head_code = '2049'
            THEN amount_lakh ELSE 0
        END) AS int_be_lakh,
        SUM(CASE
            WHEN measure = 'BE'
            THEN amount_lakh ELSE 0
        END) AS total_be_lakh
    FROM read_csv_auto('{CSV_PATH}')
    GROUP BY fiscal_year
    HAVING SUM(CASE WHEN measure = 'BE' THEN amount_lakh ELSE 0 END) != 0
)
SELECT
    fiscal_year,
    ROUND(total_be_lakh / 100.0, 2)                                          AS total_be,
    ROUND((sal_be_lakh + pen_be_lakh + int_be_lakh) / 100.0, 2)              AS committed_be
FROM raw_be
ORDER BY fiscal_year;
