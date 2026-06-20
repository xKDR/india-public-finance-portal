#!/usr/bin/env Rscript
# 01_health.R — Q1: Health spending — BE vs RE vs Actuals (MH 2210 + 2211)
#
# Shows how much the Karnataka government budgeted for health each year,
# how it revised that estimate, and how much it actually spent.
#
# Major heads:
#   2210 — Medical and Public Health
#   2211 — Family Welfare
#
# Run from repo root:
#   Rscript examples/src/r/01_health.R
# ─────────────────────────────────────────────────────────────────────────────

source(file.path(dirname(sub("--file=", "",
  grep("--file=", commandArgs(trailingOnly = FALSE), value = TRUE)[1])),
  "_lib.R"))

# ── Load data ─────────────────────────────────────────────────────────────────
cat("Loading tidy CSV ...\n")
df <- load_tidy()

# ── Filter to health major heads ──────────────────────────────────────────────
# The tidy table is already additive-leaf + canonical — just filter and sum.
hdf    <- df[df$major_head_code %in% HEALTH_MH, ]
be_yrs <- sort(unique(hdf$fiscal_year[hdf$measure == "BE"]))

# ── Build the health table ────────────────────────────────────────────────────
health_rows <- lapply(be_yrs, function(fy) {
  be  <- sum(hdf$amount_lakh[hdf$fiscal_year == fy & hdf$measure == "BE"],      na.rm = TRUE)
  if (be == 0) return(NULL)
  re  <- sum(hdf$amount_lakh[hdf$fiscal_year == fy & hdf$measure == "RE"],      na.rm = TRUE)
  act <- sum(hdf$amount_lakh[hdf$fiscal_year == fy & hdf$measure == "Actuals"], na.rm = TRUE)
  list(fy = fy, be = crore(be), re = crore(re), actuals = crore(act))
})
health_rows <- Filter(Negate(is.null), health_rows)

# ── Print results ─────────────────────────────────────────────────────────────
cat("\nQ1: Health spending — MH 2210 + 2211 (INR crore)\n")
cat(sprintf("  %-8s  %12s  %12s  %12s\n", "FY", "BE", "RE", "Actuals"))
cat(strrep("-", 50), "\n")
for (r in health_rows) {
  cat(sprintf("  %-8s  %12.2f  %12.2f  %12.2f\n",
              r$fy, r$be, r$re, r$actuals))
}
cat("\nNotes:\n")
cat("  BE = Budget Estimate (as tabled)\n")
cat("  RE = Revised Estimate (from following year's budget document)\n")
cat("  Actuals = final expenditure (from the budget 2 years later)\n")
cat("  0.00 in RE/Actuals means data is not yet available.\n")

# ── Write complete results_r.json ─────────────────────────────────────────────
cat("\nComputing all sections and writing results_r.json ...\n")
all_results <- compute_all(df)
write_results_json(all_results)
cat("Done.\n")
