mod myinstants;

#[tauri::command]
async fn lister(page: u32) -> Result<Vec<(String, String)>, String> {
    myinstants::lister(page).await
}

#[tauri::command]
async fn chercher(mot: String, page: u32) -> Result<Vec<(String, String)>, String> {
    myinstants::chercher(&mot, page).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![lister, chercher])
        .run(tauri::generate_context!())
        .expect("erreur au lancement de l'application");
}
