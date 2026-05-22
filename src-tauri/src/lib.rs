mod commands;
mod models;

use commands::{
    ai::{ask_mira, ask_wiki, polish_report},
    settings::{get_api_key_set, get_model, set_api_key},
    state::{load_state, save_state},
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            load_state,
            save_state,
            ask_mira,
            ask_wiki,
            polish_report,
            get_api_key_set,
            set_api_key,
            get_model,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
