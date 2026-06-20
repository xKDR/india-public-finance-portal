-- 00_onboarding.sql — Orientation queries for a first-time user of Karnataka budget data
--
-- Scope constants are from examples/_spec/scope.json:
--   health_major_heads    : ["2210","2211"]
--   salary_object_codes   : ["001","002","003","004","005","008","009","011","014","020","033","035"]
--   interest_major_head   : "2049"
--   pension_major_head    : "2071"
--
-- The tidy CSV is already additive-leaf, canonical-source, OCR-cleaned.
-- Amounts are in INR lakh; divide by 100 to convert to INR crore.
--
-- This file contains 3 SECTION queries, parsed by run_sql.py using "-- SECTION:" markers.

-- SECTION: top5_departments_latest_actuals
-- Top 5 departments by total Actuals in the latest available fiscal year.
WITH latest_fy AS (
    SELECT MAX(fiscal_year) AS fy
    FROM read_csv_auto('{CSV_PATH}')
    WHERE measure = 'Actuals'
),
demand_totals AS (
    SELECT
        t.demand,
        SUM(t.amount_lakh) AS total_lakh
    FROM read_csv_auto('{CSV_PATH}') t
    JOIN latest_fy ON t.fiscal_year = latest_fy.fy
    WHERE t.measure = 'Actuals'
      AND t.demand != ''
    GROUP BY t.demand
)
SELECT
    dt.demand,
    dn.name,
    ROUND(dt.total_lakh / 100.0, 2) AS amount,
    lf.fy                            AS fiscal_year
FROM demand_totals dt
JOIN demand_names dn ON dt.demand = dn.demand
CROSS JOIN latest_fy lf
ORDER BY dt.total_lakh DESC
LIMIT 5;

-- SECTION: health_be_latest
-- Latest Budget Estimate for health (major heads 2210 + 2211).
WITH latest_health_be_fy AS (
    SELECT MAX(fiscal_year) AS fy
    FROM read_csv_auto('{CSV_PATH}')
    WHERE measure = 'BE'
      AND major_head_code IN ('2210', '2211')
)
SELECT
    lf.fy                                            AS fiscal_year,
    ROUND(SUM(t.amount_lakh) / 100.0, 2)            AS amount
FROM read_csv_auto('{CSV_PATH}') t
JOIN latest_health_be_fy lf ON t.fiscal_year = lf.fy
WHERE t.measure = 'BE'
  AND t.major_head_code IN ('2210', '2211')
GROUP BY lf.fy;

-- SECTION: spend_vs_budget
-- Total Actuals vs Budget Estimate for the latest fiscal year that has Actuals.
WITH latest_act_fy AS (
    SELECT MAX(fiscal_year) AS fy
    FROM read_csv_auto('{CSV_PATH}')
    WHERE measure = 'Actuals'
),
sums AS (
    SELECT
        SUM(CASE WHEN t.measure = 'Actuals' THEN t.amount_lakh ELSE 0 END) AS act_lakh,
        SUM(CASE WHEN t.measure = 'BE'      THEN t.amount_lakh ELSE 0 END) AS be_lakh,
        lf.fy
    FROM read_csv_auto('{CSV_PATH}') t
    JOIN latest_act_fy lf ON t.fiscal_year = lf.fy
    WHERE t.measure IN ('Actuals', 'BE')
    GROUP BY lf.fy
)
SELECT
    fy                              AS fiscal_year,
    ROUND(act_lakh / 100.0, 2)     AS actuals,
    ROUND(be_lakh  / 100.0, 2)     AS be,
    ROUND(act_lakh / be_lakh, 4)   AS ratio
FROM sums;
