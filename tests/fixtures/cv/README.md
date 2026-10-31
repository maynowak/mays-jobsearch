# Synthetic CV fixture

`synthetic-cv.pdf` is a small, text-based PDF used only by
`JM-GUEST-CV-E2E-09` and the PDF extraction fixture test.

- Content is entirely synthetic: no names, emails, phone numbers or real
  employers.
- It is generated from `synthetic-cv.ps` with Ghostscript.
- Regenerate with `./generate.sh` (requires `ps2pdf` and `pdftotext`).
- `src/lib/pdfFixture.test.ts` verifies that the text is extractable with
  `pdfjs-dist`.
