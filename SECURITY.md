# Security Policy

## Reporting a vulnerability

**Please do not open public issues for security problems.**

Report vulnerabilities privately via **[Report a vulnerability](https://github.com/q7bzrbwvjk-dotcom/tresor/security/advisories/new)** on GitHub. You will receive a response within 7 days. Once a fix is released, the issue is disclosed together with credit to the reporter, at the latest 90 days after the report unless agreed otherwise.

## Supported versions

Only the latest release receives security fixes.

## Security model

**What Tresor protects against**

- Theft of the database file: contents are encrypted with AES-256 or ChaCha20; the key is derived from the master password (and optional key file) with Argon2 or AES-KDF.
- Data leaving the device: a strict Content Security Policy blocks all network requests, including from injected code.
- Shoulder surfing and stale clipboards: passwords are hidden by default, the clipboard is cleared after 30 seconds, the vault locks after inactivity, sensitive entries require the master password again.

**Known limits**

- **No independent audit.** BLAKE2b, Argon2 (JavaScript and hand-assembled WebAssembly), SHA-1/256/512, HMAC, AES (fallback when Web Crypto is unavailable), ChaCha20, Salsa20 and the KDBX implementation were written for this project. They are tested against official test vectors and independent implementations, but have not been reviewed by a third party.
- **Browser extensions** with access to all pages can read what Tresor displays. Use a browser profile without extensions.
- **JavaScript memory** cannot be wiped reliably; decrypted data may remain in memory until garbage collection.
- **Delivery over plain HTTP** allows the page itself to be modified in transit. Only use HTTPS, a local file or an encrypted tunnel.
- **Passkeys** are stored and preserved, but Tresor cannot act as a passkey provider for signing in.

## Verifying releases

Every release includes `Tresor.html.sha256`. The build is deterministic – you can rebuild a tagged commit with `python3 tools/build.py` and compare checksums.
