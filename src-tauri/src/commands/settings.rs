use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

const STORE_KEY_API_KEY: &str = "apiKey";
const STORE_KEY_MODEL: &str = "model";
const STORE_FILE: &str = "mira-settings.json";
const DEFAULT_MODEL: &str = "claude-haiku-4-5-20251001";

#[tauri::command]
pub async fn get_api_key_set(app: AppHandle) -> Result<bool, String> {
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    let is_set = store
        .get(STORE_KEY_API_KEY)
        .and_then(|v| v.as_str().map(|s| !s.is_empty()))
        .unwrap_or(false);
    Ok(is_set)
}

#[tauri::command]
pub async fn set_api_key(app: AppHandle, key: String, model: String) -> Result<(), String> {
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    store.set(STORE_KEY_API_KEY, serde_json::Value::String(key));
    store.set(STORE_KEY_MODEL, serde_json::Value::String(model));
    store.save().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_model(app: AppHandle) -> Result<String, String> {
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    let model = store
        .get(STORE_KEY_MODEL)
        .and_then(|v| v.as_str().map(|s| s.to_owned()))
        .unwrap_or_else(|| DEFAULT_MODEL.to_string());
    Ok(model)
}
