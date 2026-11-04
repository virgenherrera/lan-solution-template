// Everything that differs by OS lives here: process-tree discovery, liveness and kill.
// Verified on macOS only. Linux shares the unix code (not verified). Windows is a stub (not verified).

#[cfg(unix)]
mod imp {
  use std::collections::HashMap;
  use std::process::Command;

  fn parent_table() -> HashMap<u32, Vec<u32>> {
    let out = Command::new("ps").args(["-A", "-o", "pid=,ppid="]).output().expect("ps");
    let mut table: HashMap<u32, Vec<u32>> = HashMap::new();
    for line in String::from_utf8_lossy(&out.stdout).lines() {
      let mut it = line.split_whitespace().filter_map(|t| t.parse::<u32>().ok());
      if let (Some(pid), Some(ppid)) = (it.next(), it.next()) {
        table.entry(ppid).or_default().push(pid);
      }
    }
    table
  }

  pub fn descendants(root: u32) -> Vec<u32> {
    let table = parent_table();
    let mut found = Vec::new();
    let mut stack = vec![root];
    while let Some(p) = stack.pop() {
      for child in table.get(&p).into_iter().flatten() {
        found.push(*child);
        stack.push(*child);
      }
    }
    found
  }

  pub fn is_alive(pid: u32) -> bool {
    Command::new("kill").args(["-0", &pid.to_string()]).output().map(|o| o.status.success()).unwrap_or(false)
  }

  pub fn kill(pid: u32) {
    let _ = Command::new("kill").args(["-KILL", &pid.to_string()]).output();
  }
}

#[cfg(windows)]
mod imp {
  use std::process::Command;

  // taskkill /T walks the tree itself, so no snapshot is needed. Not verified on Windows.
  pub fn descendants(_root: u32) -> Vec<u32> {
    Vec::new()
  }

  pub fn is_alive(pid: u32) -> bool {
    Command::new("tasklist").args(["/FI", &format!("PID eq {pid}")]).output().map(|o| String::from_utf8_lossy(&o.stdout).contains(&pid.to_string())).unwrap_or(false)
  }

  pub fn kill(pid: u32) {
    let _ = Command::new("taskkill").args(["/PID", &pid.to_string(), "/T", "/F"]).output();
  }
}

pub use imp::{descendants, is_alive, kill};

// Kills the root and every snapshotted descendant that is still alive. Returns the pids it had to kill.
pub fn kill_survivors(root: u32, snapshot: &[u32]) -> Vec<u32> {
  let mut killed = Vec::new();
  for pid in std::iter::once(&root).chain(snapshot.iter()) {
    if is_alive(*pid) {
      kill(*pid);
      killed.push(*pid);
    }
  }
  killed
}

// A private copy of the certificate that is trusted: a fresh directory (0700 on unix) holding one file created with `create_new` (0600 on unix).
// The trust store is fed from this copy, never from the original path, so what was shown to the user is what is installed. Dropped = deleted.
pub struct StagedCert {
  dir: std::path::PathBuf,
  file: std::path::PathBuf,
}

impl StagedCert {
  pub fn path(&self) -> &std::path::Path {
    &self.file
  }
}

impl Drop for StagedCert {
  fn drop(&mut self) {
    let _ = std::fs::remove_dir_all(&self.dir);
  }
}

pub fn stage_cert(pem: &[u8]) -> Result<StagedCert, String> {
  use std::io::Write;
  let nanos = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0);
  let dir = std::env::temp_dir().join(format!("lan-solution-ca-{}-{nanos}", std::process::id()));
  let mut builder = std::fs::DirBuilder::new();
  #[cfg(unix)]
  std::os::unix::fs::DirBuilderExt::mode(&mut builder, 0o700);
  builder.create(&dir).map_err(|e| format!("cannot create the staging directory: {e}"))?;
  let staged = StagedCert { file: dir.join("ca.crt"), dir };
  let mut options = std::fs::OpenOptions::new();
  options.write(true).create_new(true);
  #[cfg(unix)]
  std::os::unix::fs::OpenOptionsExt::mode(&mut options, 0o600);
  let mut file = options.open(&staged.file).map_err(|e| format!("cannot stage ca.crt: {e}"))?;
  file.write_all(pem).map_err(|e| format!("cannot stage ca.crt: {e}"))?;
  Ok(staged)
}

// OS trust store for the gateway CA (REQ-TLS-02). Only the public `ca.crt` ever reaches these functions.
// macOS: the same call `dotnet dev-certs https --trust` makes, into the login keychain (command checked, store change not run by the author).
// Windows and Linux follow the same shape: not verified.
#[cfg(target_os = "macos")]
mod trust_imp {
  use std::path::Path;
  use std::process::Command;

  fn login_keychain() -> Result<std::path::PathBuf, String> {
    let home = std::env::var_os("HOME").ok_or("HOME is not set")?;
    Ok(std::path::PathBuf::from(home).join("Library").join("Keychains").join("login.keychain-db"))
  }

  pub fn is_trusted(ca: &Path) -> bool {
    Command::new("security").args(["verify-cert", "-c"]).arg(ca).args(["-p", "ssl"]).output().map(|o| o.status.success()).unwrap_or(false)
  }

  // The system asks for the user's password or Touch ID.
  pub fn trust(ca: &Path) -> Result<(), String> {
    let out = Command::new("security").args(["add-trusted-cert", "-p", "basic", "-p", "ssl", "-k"]).arg(login_keychain()?).arg(ca).output().map_err(|e| e.to_string())?;
    if out.status.success() { Ok(()) } else { Err(String::from_utf8_lossy(&out.stderr).trim().to_string()) }
  }
}

#[cfg(windows)]
mod trust_imp {
  use std::path::Path;
  use std::process::Command;

  // Asks the user Root store for the certificate of the file.
  pub fn is_trusted(ca: &Path) -> bool {
    Command::new("certutil").args(["-user", "-verifystore", "Root", &ca.to_string_lossy()]).output().map(|o| o.status.success()).unwrap_or(false)
  }

  pub fn trust(ca: &Path) -> Result<(), String> {
    let out = Command::new("certutil").args(["-user", "-addstore", "Root"]).arg(ca).output().map_err(|e| e.to_string())?;
    if out.status.success() { Ok(()) } else { Err(String::from_utf8_lossy(&out.stdout).trim().to_string()) }
  }
}

// Debian family layout. Other distributions use a different directory: not verified.
#[cfg(all(unix, not(target_os = "macos")))]
mod trust_imp {
  use std::path::Path;
  use std::process::Command;

  const TARGET: &str = "/usr/local/share/ca-certificates/lan-solution-local-ca.crt";

  pub fn is_trusted(_ca: &Path) -> bool {
    Path::new(TARGET).exists()
  }

  // pkexec shows the graphical authorization prompt.
  pub fn trust(ca: &Path) -> Result<(), String> {
    let out = Command::new("pkexec").args(["sh", "-c", "cp \"$1\" \"$2\" && update-ca-certificates", "sh"]).arg(ca).arg(TARGET).output().map_err(|e| e.to_string())?;
    if out.status.success() { Ok(()) } else { Err(String::from_utf8_lossy(&out.stderr).trim().to_string()) }
  }
}

pub use trust_imp::{is_trusted, trust};
