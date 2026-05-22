use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

use crate::models::state::{ClaudeMessage, ProjectContext};

const API_URL: &str = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL: &str = "claude-haiku-4-5-20251001";
const STORE_KEY_API_KEY: &str = "apiKey";
const STORE_KEY_MODEL: &str = "model";
const STORE_FILE: &str = "mira-settings.json";

fn get_stored_string(app: &AppHandle, key: &str) -> Option<String> {
    let store = app.store(STORE_FILE).ok()?;
    store.get(key).and_then(|v| v.as_str().map(|s| s.to_owned()))
}

async fn call_claude(
    api_key: &str,
    model: &str,
    system: &str,
    messages: Vec<ClaudeMessage>,
) -> Result<String, String> {
    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "model": model,
        "max_tokens": 2048,
        "system": system,
        "messages": messages.iter().map(|m| serde_json::json!({"role": m.role, "content": m.content})).collect::<Vec<_>>()
    });
    let resp = client
        .post(API_URL)
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("API error {}: {}", status, text));
    }

    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    json["content"][0]["text"]
        .as_str()
        .map(|s| s.to_owned())
        .ok_or_else(|| "Unexpected API response shape".to_string())
}

#[tauri::command]
pub async fn ask_mira(
    app: AppHandle,
    messages: Vec<ClaudeMessage>,
    tasks_context: String,
) -> Result<String, String> {
    let api_key = get_stored_string(&app, STORE_KEY_API_KEY)
        .ok_or_else(|| "API key not set. Please configure it in Settings.".to_string())?;
    let model = get_stored_string(&app, STORE_KEY_MODEL)
        .unwrap_or_else(|| DEFAULT_MODEL.to_string());

    let system = format!(
        "You are Mira, an intelligent work assistant for a consulting team. \
         Answer questions about the user's work based on the task data provided. \
         Be concise and helpful. When referencing specific tasks, mention their titles.\n\n\
         ## User's Task Data\n{tasks_context}"
    );

    call_claude(&api_key, &model, &system, messages).await
}

#[tauri::command]
pub async fn ask_wiki(
    app: AppHandle,
    messages: Vec<ClaudeMessage>,
    project_context: ProjectContext,
) -> Result<String, String> {
    let api_key = get_stored_string(&app, STORE_KEY_API_KEY)
        .ok_or_else(|| "API key not set. Please configure it in Settings.".to_string())?;
    let model = get_stored_string(&app, STORE_KEY_MODEL)
        .unwrap_or_else(|| DEFAULT_MODEL.to_string());

    let system = if project_context.project_name.is_empty() {
        format!(
            "You are a work insights assistant. Help the user understand patterns and insights \
             from their task history across all projects. Be analytical and helpful.\n\n\
             ## All Task Data\n{}",
            serde_json::to_string_pretty(&project_context.tasks).unwrap_or_default()
        )
    } else {
        format!(
            "You are a work insights assistant for project \"{}\". Help the user understand \
             progress, blockers, and insights specific to this project.\n\n\
             ## Project Task Data\n{}",
            project_context.project_name,
            serde_json::to_string_pretty(&project_context.tasks).unwrap_or_default()
        )
    };

    call_claude(&api_key, &model, &system, messages).await
}

#[tauri::command]
pub async fn polish_report(
    app: AppHandle,
    report_markdown: String,
    tasks_context: String,
) -> Result<String, String> {
    let api_key = get_stored_string(&app, STORE_KEY_API_KEY)
        .ok_or_else(|| "API key not set. Please configure it in Settings.".to_string())?;
    let model = get_stored_string(&app, STORE_KEY_MODEL)
        .unwrap_or_else(|| DEFAULT_MODEL.to_string());

    let system = "You are a professional writing assistant specializing in consulting work reports. \
                  Polish the provided Markdown report to be more professional, clear, and impactful. \
                  Preserve the structure and all factual content. Return only the polished Markdown.";

    let user_msg = format!(
        "Please polish this work report:\n\n{report_markdown}\n\n\
         ## Source Task Data (for context)\n{tasks_context}"
    );

    let messages = vec![ClaudeMessage {
        role: "user".to_string(),
        content: user_msg,
    }];

    call_claude(&api_key, &model, system, messages).await
}
