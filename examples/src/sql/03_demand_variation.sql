-- 03_demand_variation.sql — Q3: Variation by demand head over time
--
-- Shows how each department's spend has changed from the earliest to the
-- latest available Actuals fiscal year, and compares latest Actuals to latest BE.
--
-- demand_names table is registered by run_sql.py from
--   karnataka-state-finance/examples/demand_names.json
--
-- The tidy CSV is already additive-leaf, canonical-source, OCR-cleaned.
-- Amounts in INR lakh; divide by 100 for INR crore.

-- SECTION: q3_demand
WITH fy_range AS (
    -- Determine the first and latest fiscal years that have Actuals data.
    SELECT
        MIN(fiscal_year) AS fy_first,
        MAX(fiscal_year) AS fy_latest
    FROM read_csv_auto('{CSV_PATH}')
    WHERE measure = 'Actuals'
),
demand_agg AS (
    -- Aggregate per demand: first-year Actuals, latest-year Actuals, latest-year BE.
    SELECT
        t.demand,
        SUM(CASE WHEN t.fiscal_year = r.fy_first  AND t.measure = 'Actuals' THEN t.amount_lakh ELSE 0 END) AS first_act_lakh,
        SUM(CASE WHEN t.fiscal_year = r.fy_latest AND t.measure = 'Actuals' THEN t.amount_lakh ELSE 0 END) AS latest_act_lakh,
        SUM(CASE WHEN t.fiscal_year = r.fy_latest AND t.measure = 'BE'      THEN t.amount_lakh ELSE 0 END) AS latest_be_lakh,
        ANY_VALUE(r.fy_first)  AS fy_first,
        ANY_VALUE(r.fy_latest) AS fy_latest
    FROM read_csv_auto('{CSV_PATH}') t
    CROSS JOIN fy_range r
    WHERE t.demand != ''
    GROUP BY t.demand
    HAVING first_act_lakh != 0 OR latest_act_lakh != 0 OR latest_be_lakh != 0
)
SELECT
    da.demand,
    dn.name,
    ROUND(da.first_act_lakh  / 100.0, 2)                                             AS first_actuals,
    ROUND(da.latest_act_lakh / 100.0, 2)                                             AS latest_actuals,
    ROUND(da.latest_be_lakh  / 100.0, 2)                                             AS latest_be,
    CASE WHEN da.latest_be_lakh != 0
         THEN ROUND(da.latest_act_lakh / da.latest_be_lakh, 10)
         ELSE 0.0
    END                                                                               AS act_be,
    da.fy_first,
    da.fy_latest
FROM demand_agg da
JOIN demand_names dn ON da.demand = dn.demand
ORDER BY da.latest_act_lakh DESC;
