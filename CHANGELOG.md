# Changelog

All notable changes are documented here. Versions follow [Semantic Versioning](https://semver.org).

## 1.1.0

- **Merge preview:** see every change before merging another copy of a database – new, updated, moved and deleted entries – and decide per entry. True conflicts (changed independently on both sides) are detected from the entry history and shown side by side.
- **Password policies per group:** minimum/maximum length, required or forbidden character classes, allowed symbols and rotation interval. The generator follows the policy, the editor warns about violations and the security report lists them. Stored inside the database and inherited by subgroups.
- **Customer files:** mark a group as a customer to get a dedicated view with contact details, detected devices (IP/host, web interface link), upcoming deadlines (password expiry, rotation, licence and contract dates), all credentials by subgroup and a dated maintenance log. Printable customer data sheet. A readable summary is mirrored into the group notes for other KeePass apps.
- **Merge now includes Tresor data:** customer files, password policies and categories are reconciled too; maintenance logs from both sides are combined.
- **Activity timeline:** chronological view of created, changed, moved and deleted entries, built from the database's own history.
- All new features are available in English and German.

## 1.0.0 – first public release

- Open, edit, merge and create KeePass databases (KDBX 3.1 and 4.x; AES-256, ChaCha20; Argon2d/id, AES-KDF; key files)
- Argon2 in WebAssembly with selectable strength; pure-JavaScript cryptography fallback for non-secure contexts
- Overview dashboard with security score, security report, password rotation assistant and expiry reminders
- TOTP codes, passkey storage, attachments, history with visual diffs, recycle bin, undo
- Customisable entry categories, groups with icons, favourites, recently used, drag & drop, multi-select
- Command palette, keyboard navigation, focus mode, light and dark design, mobile layout
- CSV import from common password managers, CSV export, group export as separate encrypted database
- Printable Wi-Fi cards with QR code, entry print view, emergency sheet
- English and German user interface (follows the browser language, switchable on the start screen and in Settings)
