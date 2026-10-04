#!/usr/bin/env bash
# Veröffentlicht Tresor auf GitHub – in einzelnen, nacheinander auszuführenden Schritten.
#   ./publish.sh check                       Voraussetzungen prüfen
#   ./publish.sh prepare --author "Name"     Platzhalter ersetzen, Lizenz laden, bauen, testen, Git-Commit
#   ./publish.sh upload                      privates Repository anlegen und hochladen
#   ./publish.sh release                     Release mit Prüfsumme erstellen
#   ./publish.sh public                      öffentlich schalten, Pages und Schutzregeln aktivieren
set -euo pipefail
cd "$(dirname "$0")"
REPO_NAME="${REPO_NAME:-tresor}"
DESC="KeePass-compatible password manager in a single HTML file. Runs fully offline in your browser – open, edit and create KDBX 3.1/4.x databases. No server, no tracking, no dependencies."
TOPICS="keepass,kdbx,password-manager,offline-first,webassembly,argon2,totp,privacy,single-file"
say(){ printf '\n\033[1m▶ %s\033[0m\n' "$1"; }
die(){ printf '\033[31m✖ %s\033[0m\n' "$1" >&2; exit 1; }
gh_user(){ gh api user -q .login; }
noreply(){ echo "$(gh api user -q .id)+$(gh_user)@users.noreply.github.com"; }

cmd_check(){
  say "Voraussetzungen"
  for t in git gh python3 node curl perl; do command -v "$t" >/dev/null && echo "  ✓ $t" || die "$t fehlt (git: xcode-select --install · gh/node: brew install gh node)"; done
  gh auth status >/dev/null 2>&1 || die "Nicht bei GitHub angemeldet – bitte: gh auth login"
  echo "  ✓ angemeldet als $(gh_user)"
  echo "  Repository wird: https://github.com/$(gh_user)/$REPO_NAME"
  gh repo view "$(gh_user)/$REPO_NAME" >/dev/null 2>&1 && echo "  ! Ein Repository mit diesem Namen existiert bereits." || true
  python3 -c "import cryptography" 2>/dev/null && echo "  ✓ python cryptography (unabhängige Prüfung lokal möglich)" || echo "  – python cryptography fehlt (optional: pip3 install cryptography)"
}

cmd_prepare(){
  local author=""
  while [ $# -gt 0 ]; do case "$1" in --author) author="$2"; shift 2;; *) die "Unbekannte Option $1";; esac; done
  [ -n "$author" ] || die "Bitte Namen angeben: ./publish.sh prepare --author \"Name oder Pseudonym\""
  local user; user="$(gh_user)"
  export AUTHOR="$author" REPO_URL="https://github.com/$user/$REPO_NAME" PAGES_URL="https://$user.github.io/$REPO_NAME/"
  say "Platzhalter ersetzen (Autor: $AUTHOR)"
  grep -rlI --exclude=publish.sh --exclude=PUBLISHING.md --exclude-dir=.git -e __AUTHOR__ -e __REPO_URL__ -e __PAGES_URL__ . | while read -r f; do
    perl -pi -e 's/__AUTHOR__/$ENV{AUTHOR}/g; s/__REPO_URL__/$ENV{REPO_URL}/g; s/__PAGES_URL__/$ENV{PAGES_URL}/g' "$f"; echo "  $f"; done
  say "Lizenztext GPL-3.0"
  [ -f LICENSE ] || curl -fsSL https://www.gnu.org/licenses/gpl-3.0.txt -o LICENSE
  head -3 LICENSE | grep -q "GNU GENERAL PUBLIC LICENSE" && echo "  ✓ LICENSE" || die "LICENSE ungültig"
  say "Bauen und testen"
  python3 tools/build.py
  node tests/run-all.js
  if python3 -c "import cryptography" 2>/dev/null; then python3 tests/verify.py; else echo "  – unabhängige Prüfung übersprungen (läuft auf GitHub)"; fi
  say "Git-Commit"
  [ -d .git ] || git init -q -b main
  git add -A
  git ls-files | grep -qE '\.(kdbx|key|keyx)$' && die "Datenbank- oder Schlüsseldatei im Commit – bitte entfernen"
  git -c user.name="$AUTHOR" -c user.email="$(noreply)" commit -q -s -m "Tresor $(cat VERSION) – first public release" || echo "  (nichts zu committen)"
  git config user.name "$AUTHOR"; git config user.email "$(noreply)"
  echo "  ✓ Commit als: $AUTHOR <$(noreply)>"
  git --no-pager log --format='  %h %an <%ae> – %s' -3
  echo; echo "  Dateien im Repository:"; git ls-files | sed 's/^/    /'
}

cmd_upload(){
  local user; user="$(gh_user)"
  say "Privates Repository $user/$REPO_NAME"
  if gh repo view "$user/$REPO_NAME" >/dev/null 2>&1; then
    git remote get-url origin >/dev/null 2>&1 || git remote add origin "https://github.com/$user/$REPO_NAME.git"
    git push -u origin main
  else
    gh repo create "$REPO_NAME" --private --source . --push --description "$DESC"
  fi
  gh repo edit "$user/$REPO_NAME" --description "$DESC" --homepage "https://$user.github.io/$REPO_NAME/" --add-topic "$TOPICS" >/dev/null
  echo "  ✓ https://github.com/$user/$REPO_NAME (privat)"
  echo "  Tests laufen jetzt unter: https://github.com/$user/$REPO_NAME/actions"
}

cmd_release(){
  local v; v="$(cat VERSION)"
  say "Release v$v"
  python3 tools/build.py
  git rev-parse "v$v" >/dev/null 2>&1 || git tag -a "v$v" -m "Tresor $v"
  git push origin "v$v"
  local notes; notes="$(mktemp)"
  { awk "/^## $v/{f=1;next} /^## /{f=0} f" CHANGELOG.md; echo; echo "**SHA-256** \`$(cut -d' ' -f1 dist/Tresor.html.sha256)\`"; echo; echo "Verify: \`shasum -a 256 Tresor.html\`"; } > "$notes"
  gh release create "v$v" dist/Tresor.html dist/Tresor.html.sha256 --title "Tresor $v" --notes-file "$notes"
  rm -f "$notes"; echo "  ✓ Release erstellt – Prüfsumme: $(cut -d' ' -f1 dist/Tresor.html.sha256)"
}

cmd_public(){
  local user; user="$(gh_user)"; local r="$user/$REPO_NAME"
  say "Öffentlich schalten: $r"
  gh repo edit "$r" --visibility public --accept-visibility-change-consequences
  say "Sicherheit"
  gh api -X PUT "repos/$r/private-vulnerability-reporting" >/dev/null && echo "  ✓ private Sicherheitsmeldungen" || echo "  ! bitte manuell: Settings → Code security"
  printf '%s' '{"name":"Protect main","target":"branch","enforcement":"active","conditions":{"ref_name":{"include":["~DEFAULT_BRANCH"],"exclude":[]}},"rules":[{"type":"deletion"},{"type":"non_fast_forward"}]}' \
    | gh api -X POST "repos/$r/rulesets" --input - >/dev/null && echo "  ✓ main vor Löschen und Force-Push geschützt" || echo "  ! bitte manuell: Settings → Rules"
  say "GitHub Pages (HTTPS-Version)"
  gh api -X POST "repos/$r/pages" -f build_type=workflow >/dev/null 2>&1 || gh api -X PUT "repos/$r/pages" -f build_type=workflow >/dev/null 2>&1 || true
  gh workflow run pages.yml -R "$r" && echo "  ✓ Veröffentlichung gestartet – in 1–2 Minuten unter https://$user.github.io/$REPO_NAME/"
}

case "${1:-}" in
  check) cmd_check;; prepare) shift; cmd_prepare "$@";; upload) cmd_upload;; release) cmd_release;; public) cmd_public;;
  *) sed -n '2,7p' "$0" | sed 's/^# \{0,1\}//';;
esac
