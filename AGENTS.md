# Personal Space — Build Rules

These rules apply to all work on this project.

## The job

Build Personal Space exactly as specified in [REQUIREMENTS.md](./REQUIREMENTS.md). That document
is the contract: its phases, success criteria and final criteria decide when work is done. When in
doubt, REQUIREMENTS.md wins.

## Method

Use the superpowers workflows. The business requirements are already written — REQUIREMENTS.md is
the input to brainstorming, not its output — so brainstorm against that document, write the plan
from it, then execute phase by phase.

## Repository conventions

- End-to-end tests, and their configuration, live under `e2e/`.
- Screenshots live under `screenshots/`.
- No emojis in code, comments, print statements or logging. (Emoji page icons in the product's
  data and UI are a feature, not a violation.)
- Keep it simple: small modules, clear names, no defensive programming, no overengineering.
  Prefer popular, well-supported libraries over custom code.

## Defects and the adversarial review

- Defects found in testing live in `DEFECTS.md` at the repo root: one numbered entry per defect
  (DEF-NNN) with severity, steps to reproduce from app launch, expected vs actual, a screenshot
  where it helps, and status. A defect is closed only after the fix is retested against the
  original steps — never on the strength of the fix alone.
- Phase 6's adversarial findings live in `ADVERSARIAL_REVIEW.md` at the repo root: one numbered
  entry per finding (ADV-NNN) with what was done, expected, actual, and a disposition — either
  fixed (pointing at its DEFECTS.md entry) or rejected with a written reason. No finding may be
  left without a disposition when the project completes.
