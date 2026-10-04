# Contributing to Tresor

Thank you for your interest! Bug reports, ideas and pull requests are welcome.

## Before you start

- **Security issues:** please follow [SECURITY.md](SECURITY.md) instead of opening an issue.
- **Larger changes:** open an issue first so we can agree on the approach.
- Never include real passwords, databases or key files in issues, screenshots or tests.

## Development

```
python3 tools/build.py      # build dist/Tresor.html
node tests/run-all.js       # all tests must pass
python3 tests/verify.py     # independent KDBX check (pip install cryptography)
```

- Keep Tresor dependency-free: no external libraries, CDNs or network requests.
- Changes to cryptography or the file format need tests against official test vectors or an independent implementation.
- Every source file starts with an SPDX license header.

## Licensing of contributions

Tresor is licensed under **GPL-3.0-or-later**. By submitting a contribution you confirm that you have the right to do so and agree that it is licensed under GPL-3.0-or-later. You additionally grant the project maintainer a perpetual, worldwide, non-exclusive, royalty-free right to relicense your contribution under other open-source or commercial terms. This keeps the option open to offer Tresor under additional licenses in the future; your contribution always remains available under the GPL.

Please sign off your commits (`git commit -s`) to confirm this.
