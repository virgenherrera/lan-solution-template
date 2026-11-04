// Installs the gateway CA into the OS trust store, only after the user confirms a native dialog that shows its fingerprint (REQ-TLS-02, OQ8).
// Only `<base>/certs/ca.crt` is read. `ca.key` is never opened, copied or passed to any process (ADR-008).
use std::path::PathBuf;

use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use sha2::{Digest, Sha256};
use tauri::AppHandle;
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};

use crate::{platform, sidecar};

const TITLE: &str = "Trust the LAN Solution CA";

// The fixed path under the certs directory. Anything that resolves elsewhere (a symlink, for example) is refused.
fn ca_path() -> Result<PathBuf, String> {
  let certs = sidecar::base_dir().ok_or("no base directory")?.join("certs");
  let certs = certs.canonicalize().map_err(|e| format!("{} is missing: {e}", certs.display()))?;
  let ca = certs.join("ca.crt").canonicalize().map_err(|e| format!("ca.crt is missing: {e}"))?;
  if ca.parent() != Some(certs.as_path()) {
    return Err("ca.crt resolves outside the certs directory".into());
  }
  Ok(ca)
}

// SHA-256 of the DER bytes, shown as `AA:BB:..` like `openssl x509 -fingerprint -sha256`.
fn fingerprint(ca: &std::path::Path) -> Result<String, String> {
  let pem = std::fs::read_to_string(ca).map_err(|e| e.to_string())?;
  if pem.contains("PRIVATE KEY") {
    return Err("the file holds a private key: refused".into());
  }
  let body: String = pem.lines().skip_while(|l| !l.starts_with("-----BEGIN CERTIFICATE-----")).skip(1).take_while(|l| !l.starts_with("-----END CERTIFICATE-----")).collect();
  let der = STANDARD.decode(body.trim()).map_err(|e| format!("ca.crt is not a PEM certificate: {e}"))?;
  Ok(Sha256::digest(&der).iter().map(|b| format!("{b:02X}")).collect::<Vec<_>>().join(":"))
}

pub fn is_trusted() -> bool {
  ca_path().map(|ca| platform::is_trusted(&ca)).unwrap_or(false)
}

fn notify(app: &AppHandle, kind: MessageDialogKind, message: String) {
  app.dialog().message(message).title(TITLE).kind(kind).blocking_show();
}

fn ask(app: &AppHandle) {
  let ca = match ca_path() {
    Ok(p) => p,
    Err(e) => return notify(app, MessageDialogKind::Error, format!("Cannot trust the CA: {e}")),
  };
  let print = match fingerprint(&ca) {
    Ok(p) => p,
    Err(e) => return notify(app, MessageDialogKind::Error, format!("Cannot trust the CA: {e}")),
  };
  if platform::is_trusted(&ca) {
    log::info!("trust: ca.crt already trusted");
    return notify(app, MessageDialogKind::Info, "This computer already trusts the LAN Solution CA.".into());
  }
  let message = format!(
    "Add the local CA of this gateway to the trust store of this computer?\n\nFile: {}\nSHA-256: {print}\n\nA device that trusts this CA accepts every certificate it signs. Confirm only if the fingerprint matches the one of your own certs/ca.crt.",
    ca.display()
  );
  let confirmed = app.dialog().message(message).title(TITLE).kind(MessageDialogKind::Warning).buttons(MessageDialogButtons::OkCancelCustom("Trust".into(), "Cancel".into())).blocking_show();
  if !confirmed {
    log::info!("trust: declined by the user, trust store untouched");
    return;
  }
  log::info!("trust: confirmed by the user, fingerprint {print}");
  match platform::trust(&ca) {
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

// Tray item. The blocking dialogs run off the event loop.
pub fn request(app: &AppHandle) {
  let app = app.clone();
  std::thread::spawn(move || ask(&app));
}
