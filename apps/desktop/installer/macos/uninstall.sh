#!/bin/sh
# LAN Solution uninstall (macOS .pkg, U5). Installed in the ROOT of the install directory (mode 0755, owner root). Run it by hand: sudo <install>/uninstall.sh
# Why shell: the Mac has no node and macOS has no uninstall facility for a .pkg (odd/spikes/M0-result.md section 4).
#
# Removes: app, sea-runtime, config/config.example.json, config/config.json, .installer/ca.sha256, certs/{ca.crt,ca.key,leaf.crt,leaf.key}, the empty directories config/ .installer/ certs/, the autostart LaunchAgent of the console user, and the package receipts.
# KEEPS ALWAYS: data/ (the SQLite database and everything inside belongs to the user) and logs/. It never deletes, lists or opens anything inside them.
#
# Security rules (root runs this on a directory whose subdirectories belong to the console user, who can plant links there):
#  - no recursive removal anywhere: only `rm -f --` on the file names listed below and `rmdir` on directories that must end empty;
#  - every object is checked before it is touched: a symbolic link is skipped with a warning, only a regular file is removed; a directory that is a link is never entered;
#  - no glob over a user directory; extra files in certs/ stay and so does certs/;
#  - the CA is untrusted only when the root-owned anchor <base>/.installer/ca.sha256 (written by the installer) matches the CA file, and certs/ is removed only when the System keychain no longer holds that CA;
#  - the base is the directory of this script and must pass a sanity check.
# Writes outside the install directory: only the System keychain trust (security remove-trusted-cert, security delete-certificate), the file ~/Library/LaunchAgents/@PRODUCT@.plist of the console user, and the package receipts (pkgutil --forget).
# @IDENTIFIER@ and @PRODUCT@ are replaced by the installer builder (tools/scripts/installer-macos.ts) with `identifier` and `productName` of tauri.conf.json.
set -eu

# Fixed PATH: root must not run a tool found in the caller's PATH. (The simulation tests remove this line from a copy to put stubs first.)
PATH="/usr/bin:/bin:/usr/sbin:/sbin"
export PATH

MAIN_ID="@IDENTIFIER@"
TRUST_ID="@IDENTIFIER@.trust"
PRODUCT="@PRODUCT@"
KEYCHAIN="/Library/Keychains/System.keychain"

FAILED=0   # 1 when the trust could not be removed or the keychain state is unknown: certs/ and the anchor stay, the receipts stay, exit 1
SKIPPED=0  # objects skipped because they were links or not regular files: the receipts stay
WORK=""

say() { printf '%s\n' "uninstall: $1"; }
warn() { printf '%s\n' "uninstall: $1" >&2; }

cleanup() {
  if [ -n "$WORK" ] && [ -d "$WORK" ]; then
    rm -f "$WORK/ca.crt"
    rmdir "$WORK" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# Remove one regular file by its exact name. A link or a non-regular object is skipped.
remove_file() {
  if [ -L "$1" ]; then
    warn "$1 is a symbolic link: skipped"
    SKIPPED=$((SKIPPED + 1))
  elif [ -f "$1" ]; then
    rm -f -- "$1"
    say "removed $1"
  elif [ -e "$1" ]; then
    warn "$1 is not a regular file: skipped"
    SKIPPED=$((SKIPPED + 1))
  fi
}

# Remove one directory only when it is a real directory and empty. A non-empty one stays (its content is not ours).
remove_empty_dir() {
  if [ -L "$1" ]; then
    warn "$1 is a symbolic link: skipped"
    SKIPPED=$((SKIPPED + 1))
  elif [ -d "$1" ]; then
    if rmdir "$1" 2>/dev/null; then
      say "removed empty directory $1"
    else
      say "kept $1 (not empty)"
    fi
  fi
}

# Normalised fingerprint: no colons, upper case.
normalise() { printf '%s' "$1" | tr -d ': \t' | tr 'a-f' 'A-F'; }

main() {
  # 1. Base directory: the directory of this script, validated.
  if [ -L "$0" ]; then
    warn "$0 is a symbolic link: refused"
    exit 1
  fi
  SELF="$(basename -- "$0")"
  BASE="$(cd -- "$(dirname -- "$0")" && pwd -P)" || { warn "cannot resolve the directory of $0"; exit 1; }
  if [ "$SELF" != "uninstall.sh" ]; then
    warn "this script must be named uninstall.sh (found '$SELF'): refused"
    exit 1
  fi
  case "$BASE" in
    ""|/|/usr|/usr/local|/System|/Library|/private|/etc|/var|/bin|/sbin|/Applications|/Users|/opt|/tmp)
      warn "the install directory '$BASE' is not an acceptable location: refused"
      exit 1 ;;
  esac
  if [ "$(id -u)" -ne 0 ]; then
    warn "run it with administrator rights: sudo \"$BASE/uninstall.sh\""
    exit 1
  fi

  say "install directory: $BASE"
  say "WILL REMOVE: app, sea-runtime, config/config.example.json, config/config.json, .installer/ca.sha256, certs/ca.crt ca.key leaf.crt leaf.key, the empty directories config/ .installer/ certs/, the trust of the LAN Solution CA in the System keychain, the autostart LaunchAgent of the console user, the package receipts, and this script when nothing else is left."
  say "WILL KEEP: data/ (your database) and logs/, untouched."

  # 2. The application must not run.
  if pgrep -f -- "$BASE/app" >/dev/null 2>&1 || pgrep -f -- "$BASE/sea-runtime" >/dev/null 2>&1; then
    warn "the application is running: quit it (tray menu, Quit) and run this script again. Nothing was removed."
    exit 1
  fi

  # 3. Trust. The anchor was written by the installer in a root-owned directory; the user cannot replace it.
  CERTS="$BASE/certs"
  CA="$CERTS/ca.crt"
  INSTALLER_DIR="$BASE/.installer"
  ANCHOR="$INSTALLER_DIR/ca.sha256"
  EXPECTED=""
  ANCHOR_OK=0
  if [ -L "$INSTALLER_DIR" ] || { [ -e "$INSTALLER_DIR" ] && [ ! -d "$INSTALLER_DIR" ]; }; then
    warn "$INSTALLER_DIR is a link or not a directory: the trust anchor is not usable"
  elif [ -L "$ANCHOR" ] || { [ -e "$ANCHOR" ] && [ ! -f "$ANCHOR" ]; }; then
    warn "$ANCHOR is a link or not a regular file: the trust anchor is not usable"
  elif [ -f "$ANCHOR" ]; then
    if [ "$(stat -f%u "$INSTALLER_DIR")" != "0" ] || [ "$(stat -f%u "$ANCHOR")" != "0" ]; then
      warn "the trust anchor or its directory is not owned by root: the trust anchor is not usable"
    else
      LINE=""
      IFS= read -r LINE < "$ANCHOR" || true
      EXPECTED="$(normalise "$LINE")"
      if [ -n "$EXPECTED" ]; then ANCHOR_OK=1; else warn "$ANCHOR is empty: the trust anchor is not usable"; fi
    fi
  fi

  # What the System keychain holds now. A failure here means the trust state is unknown, so certs/ stays.
  KEYCHAIN_LIST=""
  KEYCHAIN_OK=1
  if ! KEYCHAIN_LIST="$(security find-certificate -a -Z "$KEYCHAIN" 2>/dev/null)"; then
    # find-certificate exits non-zero when there is no certificate at all or the keychain cannot be read; the two cases cannot be told apart (not verified).
    KEYCHAIN_OK=0
  fi
  KEYCHAIN_LIST="$(printf '%s' "$KEYCHAIN_LIST" | tr -d ': ' | tr 'a-f' 'A-F')"

  trust_present() { printf '%s' "$KEYCHAIN_LIST" | grep -F -q -- "$1"; }

  CERTS_MAY_GO=1
  if [ "$ANCHOR_OK" -eq 1 ]; then
    if [ "$KEYCHAIN_OK" -eq 0 ]; then
      warn "cannot read $KEYCHAIN: the trust state of the CA is unknown. certs/ and the anchor stay; run again later."
      FAILED=1
      CERTS_MAY_GO=0
    elif trust_present "$EXPECTED"; then
      say "the CA SHA-256 $EXPECTED is in $KEYCHAIN: removing its trust"
      # ca.crt is user-owned: use a private copy and prove it is the CA of the anchor before handing it to the trust store.
      if [ -L "$CERTS" ] || [ -L "$CA" ] || [ ! -f "$CA" ]; then
        warn "$CA is missing, not a regular file or reached through a link: cannot remove the trust. certs/ stays."
        FAILED=1; CERTS_MAY_GO=0
      else
        WORK="$(mktemp -d "${TMPDIR:-/tmp}/lan-untrust.XXXXXX")" || { warn "cannot create a private temporary directory"; exit 1; }
        chmod 0700 "$WORK"
        if ! cp "$CA" "$WORK/ca.crt"; then
          warn "cannot copy $CA: certs/ stays."
          FAILED=1; CERTS_MAY_GO=0
        else
          COPY_PRINT="$(openssl x509 -in "$WORK/ca.crt" -noout -fingerprint -sha256 2>/dev/null | sed 's/^.*=//')" || COPY_PRINT=""
          if [ "$(normalise "$COPY_PRINT")" != "$EXPECTED" ]; then
            warn "$CA is not the CA the installer recorded (fingerprint differs): it was replaced. Its trust was not removed and certs/ stays. Remove it by hand: security delete-certificate -Z $EXPECTED $KEYCHAIN"
            FAILED=1; CERTS_MAY_GO=0
          elif ! security remove-trusted-cert -d "$WORK/ca.crt"; then
            warn "security remove-trusted-cert failed: the trust is still there. certs/ stays."
            FAILED=1; CERTS_MAY_GO=0
          elif ! security delete-certificate -Z "$EXPECTED" "$KEYCHAIN"; then
            warn "security delete-certificate failed: the certificate is still in $KEYCHAIN. certs/ stays."
            FAILED=1; CERTS_MAY_GO=0
          else
            # Confirm that the CA is gone before certs/ is allowed to go.
            if KEYCHAIN_LIST="$(security find-certificate -a -Z "$KEYCHAIN" 2>/dev/null)"; then :; else KEYCHAIN_LIST=""; fi
            KEYCHAIN_LIST="$(printf '%s' "$KEYCHAIN_LIST" | tr -d ': ' | tr 'a-f' 'A-F')"
            if trust_present "$EXPECTED"; then
              warn "the CA is still listed in $KEYCHAIN after the removal. certs/ stays."
              FAILED=1; CERTS_MAY_GO=0
            else
              say "the CA is no longer in $KEYCHAIN"
            fi
          fi
        fi
      fi
    else
      say "the CA SHA-256 $EXPECTED is not in $KEYCHAIN (it was never trusted, or the trust was removed already): nothing to untrust"
    fi
  else
    # No usable anchor. Without it the script does not touch the keychain on the word of a user-owned file. certs/ goes only when the keychain does not hold that file's certificate.
    if [ -f "$CA" ] && [ ! -L "$CA" ] && [ ! -L "$CERTS" ]; then
      if [ "$KEYCHAIN_OK" -eq 0 ]; then
        warn "no usable trust anchor and $KEYCHAIN cannot be read: certs/ stays."
        FAILED=1; CERTS_MAY_GO=0
      else
        UNANCHORED="$(openssl x509 -in "$CA" -noout -fingerprint -sha256 2>/dev/null | sed 's/^.*=//')" || UNANCHORED=""
        UNANCHORED="$(normalise "$UNANCHORED")"
        if [ -n "$UNANCHORED" ] && trust_present "$UNANCHORED"; then
          warn "no usable trust anchor, yet $KEYCHAIN holds the certificate of $CA (SHA-256 $UNANCHORED). It cannot be shown that the installer put it there: left alone, certs/ stays. Remove it by hand if it is yours."
          FAILED=1; CERTS_MAY_GO=0
        else
          say "no trust anchor and the CA of $CA is not in $KEYCHAIN: nothing to untrust"
        fi
      fi
    else
      say "no trust anchor and no readable $CA: nothing to untrust"
    fi
  fi

  # 4. Program files.
  remove_file "$BASE/app"
  remove_file "$BASE/sea-runtime"
  if [ -L "$BASE/config" ]; then
    warn "$BASE/config is a symbolic link: skipped"
    SKIPPED=$((SKIPPED + 1))
  elif [ -d "$BASE/config" ]; then
    remove_file "$BASE/config/config.example.json"
    remove_file "$BASE/config/config.json"
    remove_empty_dir "$BASE/config"
  elif [ -e "$BASE/config" ]; then
    warn "$BASE/config is not a directory: skipped"
    SKIPPED=$((SKIPPED + 1))
  fi

  # 5. TLS files, only when no trust is left. Names are listed one by one, never globbed.
  if [ "$CERTS_MAY_GO" -eq 1 ]; then
    if [ -L "$CERTS" ]; then
      warn "$CERTS is a symbolic link: skipped, nothing inside was touched"
      SKIPPED=$((SKIPPED + 1))
    elif [ -d "$CERTS" ]; then
      for NAME in ca.crt ca.key leaf.crt leaf.key; do
        remove_file "$CERTS/$NAME"
      done
      remove_empty_dir "$CERTS"
    elif [ -e "$CERTS" ]; then
      warn "$CERTS is not a directory: skipped"
      SKIPPED=$((SKIPPED + 1))
    fi
    # The anchor goes with certs/. While certs/ stays, the anchor stays, because a later run needs it.
    if [ -L "$INSTALLER_DIR" ]; then
      warn "$INSTALLER_DIR is a symbolic link: skipped"
      SKIPPED=$((SKIPPED + 1))
    elif [ -d "$INSTALLER_DIR" ]; then
      remove_file "$ANCHOR"
      remove_empty_dir "$INSTALLER_DIR"
    elif [ -e "$INSTALLER_DIR" ]; then
      warn "$INSTALLER_DIR is not a directory: skipped"
      SKIPPED=$((SKIPPED + 1))
    fi
  else
    warn "certs/ and .installer/ stay because the trust is not confirmed removed"
  fi

  # 6. Autostart LaunchAgent of the console user (created by the host's "Start at login" item; the file name is the product name, not verified).
  CONSOLE_USER="$(stat -f%Su /dev/console 2>/dev/null)" || CONSOLE_USER=""
  if [ -z "$CONSOLE_USER" ] || [ "$CONSOLE_USER" = "root" ]; then
    say "no console user: the autostart LaunchAgent was not looked for"
  else
    HOME_DIR="$(dscl . -read "/Users/$CONSOLE_USER" NFSHomeDirectory 2>/dev/null | sed -n 's/^NFSHomeDirectory: //p' | head -n 1)" || HOME_DIR=""
    case "$HOME_DIR" in
      /*) ;;
      *) HOME_DIR="" ;;
    esac
    if [ -z "$HOME_DIR" ] || [ "$HOME_DIR" = "/" ]; then
      warn "cannot find the home directory of $CONSOLE_USER: the autostart LaunchAgent was not looked for"
    elif [ -L "$HOME_DIR/Library" ] || [ -L "$HOME_DIR/Library/LaunchAgents" ]; then
      warn "$HOME_DIR/Library or its LaunchAgents is a symbolic link: the autostart LaunchAgent was skipped"
      SKIPPED=$((SKIPPED + 1))
    else
      AGENT="$HOME_DIR/Library/LaunchAgents/$PRODUCT.plist"
      if [ -L "$AGENT" ]; then
        warn "$AGENT is a symbolic link: skipped"
        SKIPPED=$((SKIPPED + 1))
      elif [ -f "$AGENT" ]; then
        USER_ID="$(id -u "$CONSOLE_USER" 2>/dev/null)" || USER_ID=""
        if [ -n "$USER_ID" ]; then
          # Unload it first so the agent does not come back at the next login. Failure is tolerated (not loaded, or launchctl behaves otherwise: not verified).
          launchctl bootout "gui/$USER_ID" "$AGENT" >/dev/null 2>&1 || true
        fi
        remove_file "$AGENT"
      elif [ -e "$AGENT" ]; then
        warn "$AGENT is not a regular file: skipped"
        SKIPPED=$((SKIPPED + 1))
      fi
    fi
  fi

  # 7. This script and the base directory go only when nothing else is left (data/ and logs/ keep both).
  LEFT=""
  for ENTRY in "$BASE"/* "$BASE"/.[!.]* "$BASE"/..?*; do
    [ -e "$ENTRY" ] || [ -L "$ENTRY" ] || continue
    [ "$ENTRY" = "$BASE/$SELF" ] && continue
    LEFT="yes"
  done
  if [ -z "$LEFT" ]; then
    remove_file "$BASE/$SELF"
    remove_empty_dir "$BASE"
  else
    say "kept $BASE (data/, logs/ or other files remain) and this script"
  fi

  # 8. Receipts, only when everything above went well.
  if [ "$FAILED" -ne 0 ]; then
    warn "finished with errors: the receipts were NOT forgotten. Fix the cause and run this script again."
    exit 1
  fi
  if [ "$SKIPPED" -ne 0 ]; then
    warn "some objects were skipped: the receipts were NOT forgotten."
    exit 0
  fi
  for ID in "$MAIN_ID" "$TRUST_ID"; do
    if pkgutil --pkg-info "$ID" >/dev/null 2>&1; then
      if pkgutil --forget "$ID" >/dev/null; then
        say "forgot the receipt of $ID"
      else
        warn "pkgutil --forget $ID failed"
        exit 1
      fi
    fi
  done
  say "done. Your data/ and logs/ were kept."
  exit 0
}

main "$@"
