#!/usr/bin/env Rscript
# 03_demand_variation.R — Q3: Spending variation by demand head over time
#
# Compares each department's actual spending in the earliest and latest years
# available, and shows how the latest Actuals compare to the latest BE.
#
# Columns:
#   first_actuals  — total Actuals in the first year with data
#   latest_actuals — total Actuals in the most recent year with Actuals data
#   latest_be      — total BE for that same latest year
#   act_be         — ratio latest_actuals / latest_be (> 1 = overspent)
#
# Run from repo root:
#   Rscript examples/src/r/03_demand_variation.R
# ─────────────────────────────────────────────────────────────────────────────

source(file.path(dirname(sub("--file=", "",
  grep("--file=", commandArgs(trailingOnly = FALSE), value = TRUE)[1])),
  "_lib.R"))

# ── Load data ─────────────────────────────────────────────────────────────────
cat("Loading tidy CSV ...\n")
df <- load_tidy()

# ── First and latest years with Actuals data ──────────────────────────────────
act_yrs       <- sort(unique(df$fiscal_year[df$measure == "Actuals"]))
fy_first_act  <- act_yrs[1L]
fy_latest_act <- act_yrs[length(act_yrs)]

# ── Build demand-level rows ───────────────────────────────────────────────────
demand_rows <- lapply(names(DEMAND_NAMES), function(d) {
  s <- df[df$demand == d, ]
  first_act  <- sum(s$amount_lakh[s$measure == "Actuals" & s$fiscal_year == fy_first_act],  na.rm = TRUE)
  latest_act <- sum(s$amount_lakh[s$measure == "Actuals" & s$fiscal_year == fy_latest_act], na.rm = TRUE)
  latest_be  <- sum(s$amount_lakh[s$measure == "BE"      & s$fiscal_year == fy_latest_act], na.rm = TRUE)
  if (first_act == 0 && latest_act == 0 && latest_be == 0) return(NULL)
  act_be <- if (latest_be > 0) round(latest_act / latest_be, 10) else 0
  list(
    demand        = d,
    name          = DEMAND_NAMES[[d]],
    first_actuals = crore(first_act),
    latest_act    = crore(latest_act),
    latest_be     = crore(latest_be),
    act_be        = act_be
  )
})
demand_rows <- Filter(Negate(is.null), demand_rows)
# Sort by latest Actuals descending (largest spenders first)
demand_rows <- demand_rows[order(sapply(demand_rows, `[[`, "latest_act"), decreasing = TRUE)]

# ── Print results ─────────────────────────────────────────────────────────────
cat(sprintf("\nQ3: Demand variation — %s to %s (INR crore)\n", fy_first_act, fy_latest_act))
cat(sprintf("  %-3s  %-44s  %10s  %10s  %10s  %6s\n",
            "Dem", "Name", fy_first_act, fy_latest_act, "BE latest", "Act/BE"))
cat(strrep("-", 92), "\n")
for (r in demand_rows) {
  cat(sprintf("  %-3s  %-44s  %10.2f  %10.2f  %10.2f  %6.4f\n",
              r$demand, substr(r$name, 1, 44),
              r$first_actuals, r$latest_act, r$latest_be, r$act_be))
}
cat("\nNote: Act/BE > 1 means Actuals exceeded Budget Estimate.\n")

# ── Write complete results_r.json ─────────────────────────────────────────────
cat("\nComputing all sections and writing results_r.json ...\n")
all_results <- compute_all(df)
write_results_json(all_results)
cat("Done.\n")
