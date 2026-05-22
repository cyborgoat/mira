use std::fs;
use std::path::PathBuf;
use tauri::Manager;

use crate::models::state::PersistedAppState;

fn state_file_path(app: &tauri::AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .expect("failed to get app data dir")
        .join("mira-state.json")
}

#[tauri::command]
pub async fn load_state(app: tauri::AppHandle) -> Result<PersistedAppState, String> {
    let path = state_file_path(&app);
    if !path.exists() {
        return Ok(PersistedAppState::default());
    }
    let json = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&json).map_err(|e| format!("Parse error: {}", e))
}

#[tauri::command]
pub async fn save_state(
    app: tauri::AppHandle,
    state: PersistedAppState,
) -> Result<(), String> {
    let path = state_file_path(&app);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let tmp = path.with_extension("json.tmp");
    let json = serde_json::to_string_pretty(&state).map_err(|e| e.to_string())?;
    fs::write(&tmp, json).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &path).map_err(|e| e.to_string())
}
