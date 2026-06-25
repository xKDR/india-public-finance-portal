#!/usr/bin/env Rscript
# Warm-up: your first Karnataka budget query.
#
# Question: What did Karnataka actually spend on Health in 2024-25?
#
# The gentlest example here: load the tidy table, keep the rows we want, add up
# one column, convert the unit, print one number, and check the answer.
#
# This warm-up is NOT part of the reconciliation suite (`make reproduce`); it is
# a standalone first-contact script. When ready for more, open 00_onboarding.R
# and read through to 03_demand_variation.R.
#
# Run it (no Docker, no add-on packages):
#     Rscript examples/src/r/hello_budget.R

health_major_heads <- c("2210", "2211")  # Medical & Public Health + Family Welfare
fiscal_year <- "2024-25"
measure <- "Actuals"                      # actually spent, not budgeted

# Known-good answer: canonical_numbers.json -> q1_health -> 2024-25 actuals.
# Kept as a literal to keep this warm-up dependency-free (base R has no JSON
# reader); the same figure is reconciled by 01_health.R in `make reproduce`,
# so any data drift makes this self-check fail loudly.
expected_crore <- 12771.07

# Resolve paths from this script's location, so it runs from any directory.
get_script_dir <- function() {
  args <- commandArgs(trailingOnly = FALSE)
  farg <- grep("--file=", args, value = TRUE)
  if (length(farg) == 0L) return(normalizePath("."))     # interactive / sourced
  normalizePath(dirname(sub("--file=", "", farg[1L])), mustWork = FALSE)
}
processed <- file.path(get_script_dir(), "..", "..", "data", "processed")
tidy <- file.path(processed, "karnataka_budget_tidy.csv")

if (!file.exists(tidy)) {
  stop(sprintf(paste0(
    "Can't find the data file:\n  %s\n",
    "Run `make -C examples build` to generate it, or check that you cloned ",
    "the full repository."), tidy), call. = FALSE)
}

# The tidy table is already filtered to additive leaf rows, so summing is safe
# with no predicate. (Q0 in 00_onboarding.R shows what that means and why.)
d <- read.csv(tidy, colClasses = "character")
keep <- d$fiscal_year == fiscal_year &
        d$measure == measure &
        d$major_head_code %in% health_major_heads
total_crore <- sum(as.numeric(d$amount_lakh[keep])) / 100  # INR lakh -> crore

cat(sprintf("Karnataka Health spending, %s %s: Rs %s crore\n",
            fiscal_year, measure,
            formatC(total_crore, format = "f", big.mark = ",", digits = 2)))

if (abs(total_crore - expected_crore) >= 0.01) {
  stop(sprintf("self-check FAILED: got %.2f, expected %.2f crore",
               total_crore, expected_crore), call. = FALSE)
}
cat("self-check PASSED (matches the project's canonical figure)\n")
