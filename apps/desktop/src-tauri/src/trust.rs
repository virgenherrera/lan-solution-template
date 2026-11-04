// Installs the gateway CA into the OS trust store, only after the user confirms a native dialog that shows its fingerprint (REQ-TLS-02, OQ8).
// Only `<base>/certs/ca.crt` is read, once, into memory. The fingerprint is computed on those bytes and the trust store is fed a private copy of them (platform::stage_cert), never the original path.
// `ca.key` is never opened, copied or passed to any process (ADR-008).
use std::io::Read;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};

use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use sha2::{Digest, Sha256};
use tauri::AppHandle;
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};

use crate::{platform, sidecar};

const TITLE: &str = "Trust the LAN Solution CA";
const BEGIN: &str = "-----BEGIN CERTIFICATE-----";
const END: &str = "-----END CERTIFICATE-----";
const MAX_BYTES: u64 = 64 * 1024;

// One dialog or install at a time.
static BUSY: AtomicBool = AtomicBool::new(false);

struct Busy;

impl Drop for Busy {
  fn drop(&mut self) {
    BUSY.store(false, Ordering::SeqCst);
  }
}

// The certificate as the user will see it and as the OS will receive it.
struct Ca {
  path: PathBuf,
  print: String,
  pem: String,
}

// The fixed path under the certs directory. A symlink or anything that is not a regular file is refused before it is read.
fn ca_path() -> Result<PathBuf, String> {
  let certs = sidecar::base_dir().ok_or("no base directory")?.join("certs");
  let certs = certs.canonicalize().map_err(|e| format!("{} is missing: {e}", certs.display()))?;
  let ca = certs.join("ca.crt");
  let meta = std::fs::symlink_metadata(&ca).map_err(|e| format!("ca.crt is missing: {e}"))?;
  if meta.file_type().is_symlink() {
    return Err("ca.crt is a symbolic link: refused".into());
  }
  if !meta.is_file() {
    return Err("ca.crt is not a regular file: refused".into());
  }
  Ok(ca)
}

// Reads ca.crt once and checks it holds exactly one PEM certificate that is a CA. The fingerprint is the SHA-256 of its DER bytes, shown as `AA:BB:..` like `openssl x509 -fingerprint -sha256`.
fn load() -> Result<Ca, String> {
  let path = ca_path()?;
  let file = std::fs::File::open(&path).map_err(|e| e.to_string())?;
  if !file.metadata().map_err(|e| e.to_string())?.is_file() {
    return Err("ca.crt is not a regular file: refused".into());
  }
  let mut raw = Vec::new();
  file.take(MAX_BYTES + 1).read_to_end(&mut raw).map_err(|e| e.to_string())?;
  if raw.len() as u64 > MAX_BYTES {
    return Err("ca.crt is too large: refused".into());
  }
  let text = String::from_utf8(raw).map_err(|_| "ca.crt is not a PEM text file")?;
  if text.contains("PRIVATE KEY") {
    return Err("the file holds a private key: refused".into());
  }
  let blocks = text.matches("-----BEGIN ").count();
  if blocks != 1 || text.matches(BEGIN).count() != 1 {
    return Err(format!("ca.crt must hold exactly one PEM certificate, found {blocks} PEM blocks: refused"));
  }
  let start = text.find(BEGIN).unwrap_or(0) + BEGIN.len();
  let end = text.find(END).ok_or("ca.crt has no END CERTIFICATE line")?;
  if end < start {
    return Err("ca.crt is not a PEM certificate".into());
  }
  let body: String = text[start..end].split_whitespace().collect();
  let der = STANDARD.decode(body).map_err(|e| format!("ca.crt is not a PEM certificate: {e}"))?;
  let (rest, cert) = x509_parser::parse_x509_certificate(&der).map_err(|e| format!("ca.crt is not an X.509 certificate: {e}"))?;
  if !rest.is_empty() {
    return Err("ca.crt has data after the certificate: refused".into());
  }
  let is_ca = matches!(cert.basic_constraints(), Ok(Some(bc)) if bc.value.ca);
  if !is_ca {
    return Err("the certificate is not a CA (basicConstraints CA:TRUE is missing): refused".into());
  }
  let print = Sha256::digest(&der).iter().map(|b| format!("{b:02X}")).collect::<Vec<_>>().join(":");
  // Re-encoded from the DER bytes that were hashed, so the file the OS reads is exactly what the fingerprint describes.
  let b64 = STANDARD.encode(&der);
  let lines: Vec<&str> = b64.as_bytes().chunks(64).map(|c| std::str::from_utf8(c).unwrap_or("")).collect();
  let pem = format!("{BEGIN}\n{}\n{END}\n", lines.join("\n"));
  Ok(Ca { path, print, pem })
}

// Runs before any dialog: validates ca.crt and asks the OS about the staged copy.
pub fn is_trusted() -> bool {
  let ca = match load() {
    Ok(ca) => ca,
    Err(e) => {
      log::warn!("trust: ca.crt rejected: {e}");
      return false;
    }
  };
  log::info!("trust: ca.crt validated, one CA certificate, sha256 {}", ca.print);
  match platform::stage_cert(ca.pem.as_bytes()) {
    Ok(staged) => platform::is_trusted(staged.path()),
    Err(e) => {
      log::warn!("trust: {e}");
      false
    }
  }
}

fn notify(app: &AppHandle, kind: MessageDialogKind, message: String) {
  app.dialog().message(message).title(TITLE).kind(kind).blocking_show();
}

fn ask(app: &AppHandle) {
  let ca = match load() {
    Ok(ca) => ca,
    Err(e) => {
      log::error!("trust: ca.crt rejected, trust store untouched: {e}");
      return notify(app, MessageDialogKind::Error, format!("Cannot trust the CA: {e}"));
    }
  };
  // Deleted when this function returns, whatever the outcome.
  let staged = match platform::stage_cert(ca.pem.as_bytes()) {
    Ok(s) => s,
    Err(e) => {
      log::error!("trust: {e}");
      return notify(app, MessageDialogKind::Error, format!("Cannot trust the CA: {e}"));
    }
  };
  if platform::is_trusted(staged.path()) {
    log::info!("trust: ca.crt already trusted");
    return notify(app, MessageDialogKind::Info, "This computer already trusts the LAN Solution CA.".into());
  }
  let message = format!(
    "Add the local CA of this gateway to the trust store of this computer?\n\nFile: {}\nSHA-256: {}\n\nA device that trusts this CA accepts every certificate it signs. Confirm only if the fingerprint matches the one of your own certs/ca.crt.",
    ca.path.display(),
    ca.print
  );
  let confirmed = app.dialog().message(message).title(TITLE).kind(MessageDialogKind::Warning).buttons(MessageDialogButtons::OkCancelCustom("Trust".into(), "Cancel".into())).blocking_show();
  if !confirmed {
    log::info!("trust: declined by the user, trust store untouched");
    return;
  }
  log::info!("trust: confirmed by the user, fingerprint {}", ca.print);
  match platform::trust(staged.path()) {
    Ok(()) => {
      log::info!("trust: ca.crt installed");
      notify(app, MessageDialogKind::Info, "The LAN Solution CA is trusted. Use Open UI to reload the window.".into());
      if sidecar::state(app) == sidecar::HostState::Ready {
        crate::gateway::on_ready(app);
      }
    }
    Err(e) => {
      log::error!("trust: install failed: {e}");
      notify(app, MessageDialogKind::Error, format!("The trust store was not changed: {e}"));
    }
  }
}

// Tray item. The blocking dialogs run off the event loop. A click while a dialog is open or the install runs is ignored.
pub fn request(app: &AppHandle) {
  if BUSY.swap(true, Ordering::SeqCst) {
    log::info!("trust: a request is already open, click ignored");
    return;
  }
  let app = app.clone();
  std::thread::spawn(move || {
    let _busy = Busy;
    ask(&app);
  });
}
