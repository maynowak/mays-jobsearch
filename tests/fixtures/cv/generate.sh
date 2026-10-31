#!/usr/bin/env bash
# Regenerates the synthetic, text-based CV fixture.
# Requires Ghostscript (ps2pdf). The generated PDF contains only synthetic data.
set -euo pipefail
cd "$(dirname "$0")"
ps2pdf synthetic-cv.ps synthetic-cv.pdf
pdftotext synthetic-cv.pdf -
