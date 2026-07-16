#!/usr/bin/env Rscript
# 00_onboarding.R — Orientation questions for a first-time user
#
# Answers three quick questions a newcomer might ask about Karnataka's budget:
#   1. Which departments spend the most? (latest Actuals)
#   2. How much did the state budget for health? (latest BE)
#   3. How close did actual spending come to the budget? (Actuals / BE ratio)
#
# Also demonstrates the optional JSON-in-R formats path (requires jsonlite).
#
# Run from repo root:
#   Rscript examples/src/r/00_onboarding.R
# ─────────────────────────────────────────────────────────────────────────────

source(file.path(dirname(sub("--file=", "",
  grep("--file=", commandArgs(trailingOnly = FALSE), value = TRUE)[1])),
  "_lib.R"))

# ── Load data ─────────────────────────────────────────────────────────────────
cat("Loading tidy CSV ...\n")
df <- load_tidy()
cat(sprintf("  %d rows loaded\n\n", nrow(df)))

# ── Q0a: Top 5 departments by latest Actuals ──────────────────────────────────
act_yrs       <- sort(unique(df$fiscal_year[df$measure == "Actuals"]))
fy_latest_act <- act_yrs[length(act_yrs)]

act_df   <- df[df$measure == "Actuals" & df$fiscal_year == fy_latest_act, ]
d_totals <- tapply(act_df$amount_lakh, act_df$demand, sum, na.rm = TRUE)
d_sorted <- sort(d_totals, decreasing = TRUE)
top5_d   <- names(d_sorted)[1:5]

cat(sprintf("Top 5 departments by Actuals — %s\n", fy_latest_act))
cat(sprintf("  %-3s  %-44s %12s\n", "Dem", "Name", "Crore"))
cat(strrep("-", 65), "\n")
for (d in top5_d) {
  nm  <- if (!is.null(DEMAND_NAMES[[d]])) DEMAND_NAMES[[d]] else d
  cat(sprintf("  %-3s  %-44s %12.2f\n", d, nm, crore(d_sorted[[d]])))
}

# ── Q0b: Health budget (latest BE year) ───────────────────────────────────────
hbe_df  <- df[df$measure == "BE" & df$major_head_code %in% HEALTH_MH, ]
hbe_yrs <- sort(unique(hbe_df$fiscal_year))
fy_hbe  <- hbe_yrs[length(hbe_yrs)]
hbe_amt <- sum(hbe_df$amount_lakh[hbe_df$fiscal_year == fy_hbe], na.rm = TRUE)

cat(sprintf("\nHealth BE (%s, MH 2210+2211): %.2f crore\n", fy_hbe, crore(hbe_amt)))

# ── Q0c: Spend vs Budget ratio ────────────────────────────────────────────────
total_act <- sum(df$amount_lakh[df$measure == "Actuals" & df$fiscal_year == fy_latest_act],
                 na.rm = TRUE)
total_be  <- sum(df$amount_lakh[df$measure == "BE"      & df$fiscal_year == fy_latest_act],
                 na.rm = TRUE)
ratio     <- total_act / total_be

cat(sprintf("\nSpend vs Budget — %s\n", fy_latest_act))
cat(sprintf("  Actuals : %12.2f crore\n", crore(total_act)))
cat(sprintf("  BE      : %12.2f crore\n", crore(total_be)))
cat(sprintf("  Ratio   : %.4f  (%s of budget was spent)\n",
            ratio, if (ratio < 1) "less than 100%" else "more than 100%"))

# ── Formats Demo: CSV vs NDJSON ───────────────────────────────────────────────
# Shows two ways to read the same data:
#   (a) the tidy CSV — primary path, always works, base R only
#   (b) a raw NDJSON file via jsonlite::stream_in — optional demo

cat("\n── Formats Demo: CSV vs NDJSON ──────────────────────────────────────────\n")

# (a) CSV: health BE for the latest year we found above
cat(sprintf("(a) Health BE %s from CSV: %.2f crore\n", fy_hbe, crore(hbe_amt)))

# (b) NDJSON: attempt via jsonlite
.try_ndjson_demo <- function(demo_fy, demo_crore_from_csv) {
  # Install jsonlite if missing
  if (!requireNamespace("jsonlite", quietly = TRUE)) {
    message("jsonlite not installed — attempting install ...")
    tryCatch(
      install.packages("jsonlite", repos = "https://cloud.r-project.org", quiet = TRUE),
      error   = function(e) NULL,
      warning = function(w) NULL
    )
  }

  if (!requireNamespace("jsonlite", quietly = TRUE)) {
    cat("(b) jsonlite not installed; JSON-in-R demo skipped",
        "— the CSV path above is the primary one.\n")
    return(invisible(NULL))
  }

  ndjson_path <- file.path(REPO_ROOT, "state-finances", "karnataka", "KA_years",
                            paste0("KA_", demo_fy), "KA_json",
                            paste0("KA_budget_leaves_", demo_fy, ".ndjson"))
  if (!file.exists(ndjson_path)) {
    cat("(b) NDJSON not found:", ndjson_path, "\n")
    return(invisible(NULL))
  }

  cat(sprintf("(b) Reading %s via jsonlite::stream_in ...\n", basename(ndjson_path)))
  con  <- file(ndjson_path, open = "r")
  jdf  <- jsonlite::stream_in(con, verbose = FALSE)
  close(con)
  cat(sprintf("    %d leaf records in file\n", nrow(jdf)))

  # Filter health major heads.
  # jdf$hierarchy is a nested data frame; $major_head$code gives the MH code.
  health_mask <- jdf$hierarchy$major_head$code %in% HEALTH_MH
  health_jdf  <- jdf[health_mask, , drop = FALSE]

  # For each health row, extract the BE value for fiscal year = demo_fy
  # (canonical source: document year = fiscal year for BE, offset 0).
  # Each row's 'amounts' is a data frame with columns fiscal_year / measure / value.
  extract_be <- function(amt_df) {
    if (is.null(amt_df) || nrow(amt_df) == 0) return(0)
    v <- amt_df$value[amt_df$fiscal_year == demo_fy &
                      amt_df$measure     == "budget_estimate"]
    v <- v[!is.na(v) & abs(v) <= 5e6]   # drop OCR outliers (> Rs 50,000 cr)
    if (length(v) == 0) 0 else sum(v)
  }
  health_lakh_ndjson <- sum(vapply(health_jdf$amounts, extract_be, numeric(1L)))
  ndjson_crore       <- round(health_lakh_ndjson / UNIT_LAKH_TO_CRORE, 2)

  cat(sprintf("(b) Health BE %s from NDJSON (jsonlite): %.2f crore\n", demo_fy, ndjson_crore))
  cat(sprintf("    Difference vs CSV: %.4f crore (should be ~0)\n",
              abs(demo_crore_from_csv - ndjson_crore)))
  cat("Note: jsonlite installed and NDJSON demo ran successfully.\n")
  invisible(ndjson_crore)
}

.try_ndjson_demo(fy_hbe, crore(hbe_amt))

# ── Write complete results_r.json ─────────────────────────────────────────────
cat("\nComputing all sections and writing results_r.json ...\n")
all_results <- compute_all(df)
write_results_json(all_results)
cat("Done.\n")
