-- 01_health.sql — Q1: Health spending (BE vs RE vs Actuals, fiscal year by year)
--
-- Scope: major_head_code IN ('2210', '2211')   — from examples/_spec/scope.json
--
-- The tidy CSV is already additive-leaf, canonical-source, OCR-cleaned.
-- Amounts are in INR lakh; divide by 100 to convert to INR crore.
--
-- Only fiscal years that have a non-zero BE are included (years with only RE or
-- Actuals are forward/backward projections and unlikely to appear given the
-- canonical-source filtering already applied).

-- SECTION: q1_health
SELECT
    fiscal_year,
    ROUND(SUM(CASE WHEN measure = 'BE'      THEN amount_lakh ELSE 0 END) / 100.0, 2) AS be,
    ROUND(SUM(CASE WHEN measure = 'RE'      THEN amount_lakh ELSE 0 END) / 100.0, 2) AS re,
    ROUND(SUM(CASE WHEN measure = 'Actuals' THEN amount_lakh ELSE 0 END) / 100.0, 2) AS actuals
FROM read_csv_auto('{CSV_PATH}')
WHERE major_head_code IN ('2210', '2211')
GROUP BY fiscal_year
HAVING SUM(CASE WHEN measure = 'BE' THEN amount_lakh ELSE 0 END) != 0
ORDER BY fiscal_year;
