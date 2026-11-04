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
