#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 Techflow-IT
"""Builds dist/Tresor.html – a single, self-contained file – from the sources in src/.

The build is deterministic: the same sources always produce byte-identical output,
so anyone can rebuild a release and compare its SHA-256 checksum.
"""
import hashlib, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
VERSION = (ROOT / "VERSION").read_text().strip()
REPO_URL = "https://github.com/q7bzrbwvjk-dotcom/tresor"

JS_ORDER = [
    "ui/i18n.js", "crypto/cryptofb.js", "crypto/crypto.js", "crypto/argon2.js", "kdbx/kdbx.js", "crypto/otp.js",
    "ui/icons.js", "ui/words.js", "kdbx/merge.js", "kdbx/csv.js", "crypto/qr.js",
    "ui/app.js", "ui/app2.js", "ui/app3.js", "ui/app4.js", "ui/app5.js", "ui/app6.js", "ui/app7.js",
]
CSS_ORDER = ["styles/style.css", "styles/style2.css"]

def strip_header(text: str) -> str:
    """Removes the per-file license header; the built file carries one central header."""
    text = re.sub(r"\A(// [^\n]*\n){1,3}", "", text) if text.startswith("// SPDX") else text
    text = re.sub(r"\A/\* SPDX.*?\*/\n", "", text, flags=re.S)
    return text

def read(rel: str) -> str:
    return strip_header((SRC / rel).read_text(encoding="utf-8"))

css = "".join(read(f) for f in CSS_ORDER)
js = "\n".join(read(f) for f in JS_ORDER)
body = (SRC / "ui/body.html").read_text(encoding="utf-8")
csp = ("default-src 'none'; script-src 'unsafe-inline' 'wasm-unsafe-eval' blob:; worker-src blob:; "
       "style-src 'unsafe-inline'; img-src data: blob:; connect-src blob: data:")

html = f"""<!doctype html>
<!--
  Tresor {VERSION} – KeePass-compatible password manager in a single file.
  Copyright (C) 2026 Techflow-IT
  SPDX-License-Identifier: GPL-3.0-or-later

  This program is free software: you can redistribute it and/or modify it under the terms of the
  GNU General Public License as published by the Free Software Foundation, either version 3 of the
  License, or (at your option) any later version. It is distributed WITHOUT ANY WARRANTY.
  Source code and license: {REPO_URL}
-->
<html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="{csp}">
<meta name="referrer" content="no-referrer">
<meta name="generator" content="Tresor {VERSION}">
<title>Tresor – KeePass</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%F0%9F%94%90%3C/text%3E%3C/svg%3E">
<style>{css}</style></head><body>
{body}
<script>
"use strict";
{js}
</script></body></html>"""

out = ROOT / "dist" / "Tresor.html"
out.parent.mkdir(exist_ok=True)
out.write_bytes(html.encode("utf-8"))
digest = hashlib.sha256(html.encode("utf-8")).hexdigest()
(ROOT / "dist" / "Tresor.html.sha256").write_text(f"{digest}  Tresor.html\n")
print(f"Built {out.relative_to(ROOT)} ({len(html.encode()):,} bytes)\nSHA-256 {digest}")
