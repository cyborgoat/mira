use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::PathBuf;
use std::process;
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};
use tauri::{Manager, RunEvent};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

struct ApiSidecar(Mutex<Option<CommandChild>>);

pub fn run() {
  let app = tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .setup(|app| {
      let native_cache = app.path().app_cache_dir()?.join("pkg-native-cache");
      let data_dir = mira_data_dir(app);
      let workspace_root = data_dir.join("workspace");
      let wiki_root = data_dir.join("llm-wiki");
      let llm_config_root = data_dir.join("config").join("llm");
      let database_url = format!("file:{}", data_dir.join("mira-api.sqlite3").display());
      let _ = std::fs::create_dir_all(&native_cache);
      let _ = std::fs::create_dir_all(&llm_config_root);
      if api_health_is_ok() {
        eprintln!("Mira API sidecar is already available on 127.0.0.1:8173; reusing it.");
        app.manage(ApiSidecar(Mutex::new(None)));
        return Ok(());
      }
      if api_port_is_open() {
        eprintln!("Port 8173 is already in use, but it is not responding as Mira API. Stop that process and run npm run dev:desktop again.");
        process::exit(1);
      }
      let sidecar = app
        .shell()
        .sidecar("mira-api")
        .map_err(|error| format!("failed to locate Mira API sidecar: {error}"))
        .and_then(|command| {
          command
            .env("HOST", "127.0.0.1")
            .env("PORT", "8173")
            .env("PKG_NATIVE_CACHE_PATH", native_cache)
            .env("MIRA_DATABASE_URL", database_url)
            .env("MIRA_WORKSPACE_ROOT", workspace_root)
            .env("MIRA_WIKI_ROOT", wiki_root)
            .env("MIRA_LLM_CONFIG_ROOT", llm_config_root)
            .current_dir(data_dir.parent().unwrap_or(&data_dir))
            .spawn()
            .map_err(|error| format!("failed to spawn Mira API sidecar: {error}"))
        });

      let Ok((mut receiver, child)) = sidecar else {
        if let Err(error) = sidecar {
          eprintln!("{error}");
        }
        process::exit(1);
      };

      thread::spawn(move || {
        while let Some(event) = receiver.blocking_recv() {
          match event {
            CommandEvent::Stdout(line) => eprint!("{}", String::from_utf8_lossy(&line)),
            CommandEvent::Stderr(line) => eprint!("{}", String::from_utf8_lossy(&line)),
            CommandEvent::Error(error) => eprintln!("Mira API sidecar error: {error}"),
            CommandEvent::Terminated(payload) => eprintln!("Mira API sidecar exited: code={:?} signal={:?}", payload.code, payload.signal),
            _ => {}
          }
        }
      });

      if !wait_for_api(Duration::from_secs(20)) {
        eprintln!("Mira API sidecar did not become ready on http://127.0.0.1:8173/health within 20 seconds.");
        let _ = child.kill();
        process::exit(1);
      }

      app.manage(ApiSidecar(Mutex::new(Some(child))));
      Ok(())
    })
    .build(tauri::generate_context!());

  let app = match app {
    Ok(app) => app,
    Err(error) => {
      eprintln!("Failed to start Mira desktop: {error}");
      process::exit(1);
    }
  };

  app.run(|app_handle, event| {
      if let RunEvent::ExitRequested { .. } = event {
        if let Some(sidecar) = app_handle.try_state::<ApiSidecar>() {
          if let Ok(mut child) = sidecar.0.lock() {
            if let Some(child) = child.take() {
              let _ = child.kill();
            }
          }
        }
      }
    });
}

fn mira_data_dir(app: &tauri::App) -> PathBuf {
  // In a production .app bundle the executable lives inside *.app/Contents/MacOS.
  // Only attempt repo-workspace discovery in dev mode (no .app bundle in the path).
  let in_app_bundle = std::env::current_exe()
    .map(|p| p.to_string_lossy().contains(".app/Contents"))
    .unwrap_or(false);

  if !in_app_bundle {
    if let Some(path) = find_repo_workspace() {
      return path;
    }
  }

  app.path()
    .app_data_dir()
    .unwrap_or_else(|_| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")))
    .join("mira-workspace")
}

fn find_repo_workspace() -> Option<PathBuf> {
  let mut candidates = Vec::new();
  if let Ok(current_dir) = std::env::current_dir() {
    candidates.push(current_dir);
  }
  if let Ok(current_exe) = std::env::current_exe() {
    if let Some(parent) = current_exe.parent() {
      candidates.push(parent.to_path_buf());
    }
  }

  for candidate in &candidates {
    for ancestor in candidate.ancestors() {
      let workspace = ancestor.join("mira-workspace");
      if ancestor.join("package.json").exists() && ancestor.join("apps").exists() && workspace.exists() {
        return Some(workspace);
      }
    }
  }

  for candidate in candidates {
    for ancestor in candidate.ancestors() {
      let workspace = ancestor.join("mira-workspace");
      if workspace.exists() {
        return Some(workspace);
      }
    }
  }
  None
}

fn api_port_is_open() -> bool {
  match "127.0.0.1:8173".parse() {
    Ok(address) => TcpStream::connect_timeout(&address, Duration::from_millis(150)).is_ok(),
    Err(_) => false,
  }
}

fn wait_for_api(timeout: Duration) -> bool {
  let deadline = Instant::now() + timeout;
  while Instant::now() < deadline {
    if api_health_is_ok() {
      return true;
    }
    thread::sleep(Duration::from_millis(250));
  }
  false
}

fn api_health_is_ok() -> bool {
  let Ok(address) = "127.0.0.1:8173".parse() else {
    return false;
  };
  let Ok(mut stream) = TcpStream::connect_timeout(&address, Duration::from_millis(150)) else {
    return false;
  };
  let _ = stream.set_read_timeout(Some(Duration::from_millis(500)));
  let _ = stream.set_write_timeout(Some(Duration::from_millis(500)));
  if stream.write_all(b"GET /health HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n").is_err() {
    return false;
  }
  let mut response = String::new();
  if stream.read_to_string(&mut response).is_err() {
    return false;
  }
  response.starts_with("HTTP/1.1 200") && response.contains("\"status\":\"ok\"")
}

fn main() {
  run();
}
