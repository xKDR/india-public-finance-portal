# _lib.R — shared helpers for Karnataka budget R examples
#
# Sourced by 00_onboarding.R … 03_demand_variation.R.
# Primary data path: base R + tidy CSV.  No add-on packages required.
#
# Contract (from examples/_spec/README.md):
#   - tidy CSV is already additive-leaf and canonical-source — just filter & sum
#   - amounts in INR_lakh; divide by 100 for INR_crore
#   - scope constants (health MHs, salary OH codes, etc.) read from scope.json
# ─────────────────────────────────────────────────────────────────────────────

# ── 1. Script-relative path resolution ───────────────────────────────────────
# Works when invoked as:  Rscript examples/src/r/00_onboarding.R
# from any working directory, including the repo root or examples/.

.get_script_dir <- function() {
  args <- commandArgs(trailingOnly = FALSE)
  farg <- grep("--file=", args, value = TRUE)
  if (length(farg) == 0L) {
    # Interactive / sourced without --file= (fall back to working dir)
    return(normalizePath("."))
  }
  normalizePath(dirname(sub("--file=", "", farg[1L])), mustWork = FALSE)
}

.SCRIPT_DIR  <- .get_script_dir()           # .../examples/src/r
EXAMPLES_DIR <- normalizePath(file.path(.SCRIPT_DIR, "..", ".."), mustWork = FALSE)  # .../examples
REPO_ROOT    <- normalizePath(file.path(.SCRIPT_DIR, "..", "..", ".."), mustWork = FALSE)

# ── 2. Load scope constants ───────────────────────────────────────────────────
# Use jsonlite if available; fall back to a targeted line-by-line reader
# sufficient for the fixed shape of scope.json.

.load_scope <- function(path) {
  if (requireNamespace("jsonlite", quietly = TRUE)) {
    return(jsonlite::fromJSON(path))
  }
  # Minimal base-R reader: extract the specific fields we need.
  txt <- paste(readLines(path, warn = FALSE), collapse = "\n")

  .ext_num <- function(key) {
    m <- regmatches(txt, regexpr(paste0('"', key, '"\\s*:\\s*([0-9.]+)'), txt))
    as.numeric(sub(paste0('"', key, '"\\s*:\\s*'), "", m))
  }
  .ext_str <- function(key) {
    m <- regmatches(txt, regexpr(paste0('"', key, '"\\s*:\\s*"([^"]*)"'), txt))
    sub(paste0('"', key, '"\\s*:\\s*"'), "", sub('"$', "", m))
  }
  .ext_arr <- function(key) {
    # Extract a JSON array of quoted strings, e.g. ["001","002",...]
    blk <- regmatches(txt, regexpr(
      paste0('"', key, '"\\s*:\\s*\\[[^\\]]*\\]'), txt, perl = TRUE))
    if (length(blk) == 0L) return(character(0))
    gsub('"', "", regmatches(blk, gregexpr('"[^"]*"', blk))[[1]])
  }

  list(
    unit_lakh_to_crore  = .ext_num("unit_lakh_to_crore"),
    health_major_heads  = .ext_arr("health_major_heads"),
    interest_major_head = .ext_str("interest_major_head"),
    pension_major_head  = .ext_str("pension_major_head"),
    salary_object_codes = .ext_arr("salary_object_codes")
  )
}

SCOPE <- .load_scope(file.path(EXAMPLES_DIR, "_spec", "scope.json"))

# Unpack scope constants with clear names
UNIT_LAKH_TO_CRORE <- SCOPE$unit_lakh_to_crore    # 100  (lakh / crore)
HEALTH_MH          <- SCOPE$health_major_heads     # c("2210", "2211")
INTEREST_MH        <- SCOPE$interest_major_head    # "2049"
PENSION_MH         <- SCOPE$pension_major_head     # "2071"
SALARY_OH          <- SCOPE$salary_object_codes    # c("001","002",...)

# ── 3. Load demand names ──────────────────────────────────────────────────────
# Simple line-by-line reader for demand_names.json.
# Each demand line: "01": {"name": "Agriculture...", "short": ...}

.load_demand_names <- function() {
  path  <- file.path(REPO_ROOT, "karnataka-state-finance", "demand_names.json")
  lines <- readLines(path, warn = FALSE)
  # Match:  "DD": {"name": "Name Text"
  pat   <- '^\\s*"(\\d{2})"\\s*:\\s*\\{\\s*"name"\\s*:\\s*"([^"]+)"'
  out   <- list()
  for (line in lines) {
    m <- regmatches(line, regexec(pat, line, perl = TRUE))[[1]]
    if (length(m) == 3L) out[[m[2L]]] <- m[3L]
  }
  out  # named list: "01" -> "Agriculture and Horticulture", etc.
}

DEMAND_NAMES <- .load_demand_names()

# ── 4. Load tidy CSV ──────────────────────────────────────────────────────────
# Specify colClasses to preserve leading zeros in code columns
# (e.g. object_head_code "001" must not become integer 1).

load_tidy <- function() {
  path <- file.path(EXAMPLES_DIR, "data", "processed", "karnataka_budget_tidy.csv")
  read.csv(path, stringsAsFactors = FALSE,
           colClasses = c(
             document_year           = "character",
             fiscal_year             = "character",
             measure                 = "character",
             demand                  = "character",
             major_head_code         = "character",
             major_head_name         = "character",
             object_head_code        = "character",
             object_head_description = "character",
             amount_lakh             = "numeric",
             amount_unit             = "character"
           ))
}

# ── 5. Monetary helper ────────────────────────────────────────────────────────
# Convert INR lakh -> INR crore, rounded to 2 decimal places.
crore <- function(x) round(x / UNIT_LAKH_TO_CRORE, 2)

# ── 6. Computation functions ─────────────────────────────────────────────────

# ── 6a. Onboarding ────────────────────────────────────────────────────────────
compute_onboarding <- function(df) {
  # Find the latest fiscal year that has Actuals data.
  act_yrs       <- sort(unique(df$fiscal_year[df$measure == "Actuals"]))
  fy_latest_act <- act_yrs[length(act_yrs)]

  # ── Top 5 departments by total Actuals in the latest Actuals year ──────────
  act_df   <- df[df$measure == "Actuals" & df$fiscal_year == fy_latest_act, ]
  d_totals <- tapply(act_df$amount_lakh, act_df$demand, sum, na.rm = TRUE)
  d_sorted <- sort(d_totals, decreasing = TRUE)
  top5_d   <- names(d_sorted)[seq_len(min(5L, length(d_sorted)))]
  top5_rows <- lapply(top5_d, function(d) {
    list(demand = d,
         name   = if (!is.null(DEMAND_NAMES[[d]])) DEMAND_NAMES[[d]] else d,
         amount = crore(d_sorted[[d]]))
  })

  # ── Latest fiscal year with health BE data ─────────────────────────────────
  hbe_df    <- df[df$measure == "BE" & df$major_head_code %in% HEALTH_MH, ]
  hbe_yrs   <- sort(unique(hbe_df$fiscal_year))
  fy_hbe    <- hbe_yrs[length(hbe_yrs)]
  health_be <- sum(hbe_df$amount_lakh[hbe_df$fiscal_year == fy_hbe], na.rm = TRUE)

  # ── Spend vs Budget: Actuals / BE for the latest Actuals year ─────────────
  total_act <- sum(df$amount_lakh[df$measure == "Actuals" & df$fiscal_year == fy_latest_act],
                   na.rm = TRUE)
  total_be  <- sum(df$amount_lakh[df$measure == "BE" & df$fiscal_year == fy_latest_act],
                   na.rm = TRUE)
  ratio <- if (total_be > 0) round(total_act / total_be, 4) else 0

  list(
    top5_departments_latest_actuals = list(
      fiscal_year = fy_latest_act,
      rows        = top5_rows
    ),
    health_be_latest = list(
      fiscal_year = fy_hbe,
      amount      = crore(health_be)
    ),
    spend_vs_budget = list(
      fiscal_year = fy_latest_act,
      actuals     = crore(total_act),
      be          = crore(total_be),
      ratio       = ratio
    )
  )
}

# ── 6b. Q1 Health spending ────────────────────────────────────────────────────
compute_q1_health <- function(df) {
  # Filter to health major heads (2210 = Medical, 2211 = Family Welfare).
  hdf    <- df[df$major_head_code %in% HEALTH_MH, ]
  be_yrs <- sort(unique(hdf$fiscal_year[hdf$measure == "BE"]))

  rows <- lapply(be_yrs, function(fy) {
    be <- sum(hdf$amount_lakh[hdf$fiscal_year == fy & hdf$measure == "BE"],
              na.rm = TRUE)
    if (be == 0) return(NULL)  # skip years with no BE data
    re  <- sum(hdf$amount_lakh[hdf$fiscal_year == fy & hdf$measure == "RE"],
               na.rm = TRUE)
    act <- sum(hdf$amount_lakh[hdf$fiscal_year == fy & hdf$measure == "Actuals"],
               na.rm = TRUE)
    list(fiscal_year = fy,
         be          = crore(be),
         re          = crore(re),
         actuals     = crore(act))
  })
  Filter(Negate(is.null), rows)
}

# ── 6c. Q2 Committed expenditure (Actuals) ───────────────────────────────────
compute_q2_committed <- function(df) {
  # Priority: pension MH (2071) > interest MH (2049) > salary OH codes.
  # A row is counted in at most one category.
  act_yrs <- sort(unique(df$fiscal_year[df$measure == "Actuals"]))

  lapply(act_yrs, function(fy) {
    s <- df[df$measure == "Actuals" & df$fiscal_year == fy, ]

    is_pension  <- s$major_head_code == PENSION_MH
    is_interest <- s$major_head_code == INTEREST_MH  # mutually exclusive with pension
    is_salary   <- s$object_head_code %in% SALARY_OH & !is_pension & !is_interest

    pen  <- sum(s$amount_lakh[is_pension],  na.rm = TRUE)
    intr <- sum(s$amount_lakh[is_interest], na.rm = TRUE)
    sal  <- sum(s$amount_lakh[is_salary],   na.rm = TRUE)

    committed <- sal + pen + intr
    total_act <- sum(s$amount_lakh, na.rm = TRUE)
    share     <- if (total_act > 0) round(100 * committed / total_act, 2) else 0

    list(
      fiscal_year       = fy,
      salaries          = crore(sal),
      pensions          = crore(pen),
      interest          = crore(intr),
      committed         = crore(committed),
      total_exp_actuals = crore(total_act),
      share_pct         = share
    )
  })
}

# ── 6d. Q3 Demand variation over time ────────────────────────────────────────
compute_q3_demand <- function(df) {
  act_yrs       <- sort(unique(df$fiscal_year[df$measure == "Actuals"]))
  fy_first_act  <- act_yrs[1L]
  fy_latest_act <- act_yrs[length(act_yrs)]

  rows <- lapply(names(DEMAND_NAMES), function(d) {
    s <- df[df$demand == d, ]
    first_act  <- sum(s$amount_lakh[s$measure == "Actuals" & s$fiscal_year == fy_first_act],
                      na.rm = TRUE)
    latest_act <- sum(s$amount_lakh[s$measure == "Actuals" & s$fiscal_year == fy_latest_act],
                      na.rm = TRUE)
    latest_be  <- sum(s$amount_lakh[s$measure == "BE"      & s$fiscal_year == fy_latest_act],
                      na.rm = TRUE)
    # Skip demands with no data at all
    if (first_act == 0 && latest_act == 0 && latest_be == 0) return(NULL)
    act_be <- if (latest_be > 0) round(latest_act / latest_be, 10) else 0
    list(
      demand         = d,
      name           = DEMAND_NAMES[[d]],
      first_actuals  = crore(first_act),
      latest_actuals = crore(latest_act),
      latest_be      = crore(latest_be),
      act_be         = act_be
    )
  })
  rows <- Filter(Negate(is.null), rows)
  # Sort by latest_actuals descending (largest spender first)
  rows <- rows[order(sapply(rows, `[[`, "latest_actuals"), decreasing = TRUE)]

  list(
    fiscal_year_first  = fy_first_act,
    fiscal_year_latest = fy_latest_act,
    rows               = rows
  )
}

# ── 6e. Total expenditure (BE) ────────────────────────────────────────────────
compute_total_expenditure <- function(df) {
  be_yrs <- sort(unique(df$fiscal_year[df$measure == "BE"]))

  rows <- lapply(be_yrs, function(fy) {
    s        <- df[df$measure == "BE" & df$fiscal_year == fy, ]
    total_be <- sum(s$amount_lakh, na.rm = TRUE)
    if (total_be == 0) return(NULL)

    is_pension  <- s$major_head_code == PENSION_MH
    is_interest <- s$major_head_code == INTEREST_MH
    is_salary   <- s$object_head_code %in% SALARY_OH & !is_pension & !is_interest

    comm_be <- sum(s$amount_lakh[is_pension],  na.rm = TRUE) +
               sum(s$amount_lakh[is_interest], na.rm = TRUE) +
               sum(s$amount_lakh[is_salary],   na.rm = TRUE)

    list(fiscal_year  = fy,
         total_be     = crore(total_be),
         committed_be = crore(comm_be))
  })
  Filter(Negate(is.null), rows)
}

# ── 6f. Compute all sections ──────────────────────────────────────────────────
compute_all <- function(df) {
  list(
    unit              = "INR_crore",
    tolerance_crore   = 0.01,
    onboarding        = compute_onboarding(df),
    q1_health         = compute_q1_health(df),
    q2_committed      = compute_q2_committed(df),
    q3_demand         = compute_q3_demand(df),
    total_expenditure = compute_total_expenditure(df)
  )
}

# ── 7. Base-R JSON writer (no external packages) ─────────────────────────────
# Hand-rolled serialiser.  Writes numbers with up to 10 decimal places and
# strips trailing zeros (preserving at least one decimal, e.g. "0.0").

.fmt_num <- function(x) {
  s <- formatC(x, format = "f", digits = 10)  # 10 decimal places
  s <- sub("0+$",  "",   s)                   # strip trailing zeros
  s <- sub("\\.$", ".0", s)                   # bare "." -> ".0" (e.g. 0 -> 0.0)
  s
}

.to_json <- function(x, depth = 0L) {
  pad  <- paste(rep("  ", depth),      collapse = "")
  ipad <- paste(rep("  ", depth + 1L), collapse = "")

  if (is.null(x))                          return("null")
  if (is.logical(x) && length(x) == 1L)   return(if (x) "true" else "false")
  if (is.numeric(x) && length(x) == 1L)   return(.fmt_num(x))
  if (is.character(x) && length(x) == 1L) {
    esc <- gsub('\\',  '\\\\', x, fixed = TRUE)
    esc <- gsub('"',   '\\"',  esc, fixed = TRUE)
    return(paste0('"', esc, '"'))
  }
  if (is.list(x) && !is.null(names(x))) {
    # Named list -> JSON object
    parts <- vapply(names(x), function(k) {
      paste0(ipad, '"', k, '": ', .to_json(x[[k]], depth + 1L))
    }, character(1L))
    paste0("{\n", paste(parts, collapse = ",\n"), "\n", pad, "}")
  } else if (is.list(x)) {
    # Unnamed list -> JSON array
    parts <- vapply(x, function(el) {
      paste0(ipad, .to_json(el, depth + 1L))
    }, character(1L))
    paste0("[\n", paste(parts, collapse = ",\n"), "\n", pad, "]")
  } else {
    stop(paste("Unhandled type:", class(x), "of length", length(x)))
  }
}

write_results_json <- function(results) {
  out_path <- file.path(EXAMPLES_DIR, "out", "results_r.json")
  dir.create(dirname(out_path), showWarnings = FALSE, recursive = TRUE)
  writeLines(.to_json(results), out_path)
  cat("Written:", out_path, "\n")
  invisible(out_path)
}
