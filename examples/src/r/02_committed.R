#!/usr/bin/env Rscript
# 02_committed.R — Q2: Committed expenditure — salaries + pensions + interest
#
# "Committed" expenditure is money the government is legally or contractually
# obliged to pay: employee salaries, pensioner payments, and interest on debt.
# It is the least flexible part of the budget.
#
# Categories and their identifiers (from scope.json):
#   Pensions  — major head 2071 (highest priority)
#   Interest  — major head 2049
#   Salaries  — object head codes 001–005, 008–009, 011, 014, 020, 033, 035
#               (only if the row is NOT already counted as pension or interest)
#
# Run from repo root:
#   Rscript examples/src/r/02_committed.R
# ─────────────────────────────────────────────────────────────────────────────

source(file.path(dirname(sub("--file=", "",
  grep("--file=", commandArgs(trailingOnly = FALSE), value = TRUE)[1])),
  "_lib.R"))

# ── Load data ─────────────────────────────────────────────────────────────────
cat("Loading tidy CSV ...\n")
df <- load_tidy()

# ── Compute committed expenditure for each year ───────────────────────────────
# Using Actuals only (we know what was actually paid).
act_yrs <- sort(unique(df$fiscal_year[df$measure == "Actuals"]))

results <- lapply(act_yrs, function(fy) {
  s <- df[df$measure == "Actuals" & df$fiscal_year == fy, ]

  # Priority masks — a row is counted in at most one category.
  is_pension  <- s$major_head_code == PENSION_MH    # 2071
  is_interest <- s$major_head_code == INTEREST_MH   # 2049  (never also pension)
  is_salary   <- s$object_head_code %in% SALARY_OH & !is_pension & !is_interest

  pen  <- sum(s$amount_lakh[is_pension],  na.rm = TRUE)
  intr <- sum(s$amount_lakh[is_interest], na.rm = TRUE)
  sal  <- sum(s$amount_lakh[is_salary],   na.rm = TRUE)

  total_act <- sum(s$amount_lakh, na.rm = TRUE)
  committed <- sal + pen + intr
  share     <- if (total_act > 0) round(100 * committed / total_act, 2) else 0

  list(fy = fy, sal = crore(sal), pen = crore(pen), intr = crore(intr),
       committed = crore(committed), total = crore(total_act), share = share)
})

# ── Print results ─────────────────────────────────────────────────────────────
cat("\nQ2: Committed expenditure — Actuals (INR crore)\n")
cat(sprintf("  %-8s  %10s  %10s  %10s  %10s  %10s  %6s\n",
            "FY", "Salaries", "Pensions", "Interest", "Committed", "Total", "Share%"))
cat(strrep("-", 76), "\n")
for (r in results) {
  cat(sprintf("  %-8s  %10.2f  %10.2f  %10.2f  %10.2f  %10.2f  %5.2f%%\n",
              r$fy, r$sal, r$pen, r$intr, r$committed, r$total, r$share))
}
cat("\nNote: Share% = committed / total Actuals expenditure × 100\n")
cat("Priority rule: pension MH (2071) > interest MH (2049) > salary OH codes\n")

# ── Write complete results_r.json ─────────────────────────────────────────────
cat("\nComputing all sections and writing results_r.json ...\n")
all_results <- compute_all(df)
write_results_json(all_results)
cat("Done.\n")
