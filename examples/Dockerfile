# Reproducible environment for the Karnataka examples compendium.
# Pinned: R 4.4.1 (base image), Python 3 + DuckDB 1.5.4 (pip wheel), jsonlite (CRAN snapshot).
#
# This image carries only the toolchain; the code and data are bind-mounted at run
# time (see compose.yaml) so the image stays small and always matches the working tree.
#   Build:  docker build -f examples/Dockerfile -t ka-examples ..
#   Run:    docker run --rm -v "$PWD:/work" -w /work/examples ka-examples make reproduce
#
# NOTE: Docker is not built/run in the authoring environment; the image is authored and
# inspected. The Python and SQL code it runs is byte-for-byte the same code verified
# natively via `make -C examples reproduce` (see examples/doc + the task report).

FROM rocker/r-ver:4.4.1

# System Python 3 + pip + make (rocker/r-ver:4.4.1 is Ubuntu-based).
RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 python3-pip make \
    && rm -rf /var/lib/apt/lists/*

# Python: DuckDB wheel, pinned to the version verified by the SQL track.
RUN python3 -m pip install --no-cache-dir 'duckdb==1.5.4'

# R: jsonlite (only the optional JSON-in-R demo needs it), pinned via a dated CRAN snapshot.
RUN R -e "install.packages('jsonlite', repos='https://packagemanager.posit.co/cran/2025-06-02')" \
 && R -e "stopifnot(packageVersion('jsonlite') >= '1.8.9')"

WORKDIR /work/examples
CMD ["make", "reproduce"]
