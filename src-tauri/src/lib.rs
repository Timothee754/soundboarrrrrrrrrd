mod micro_virtuel;
mod sources;

use micro_virtuel::MicroVirtuel;
use tauri::{Manager, RunEvent, State};

// Le micro virtuel, ou l'erreur qui l'a empêché de démarrer (l'app reste utilisable pour écouter).
type Micro = Result<MicroVirtuel, String>;

#[tauri::command]
async fn lister(source: String, page: u32) -> Result<sources::Sons, String> {
    sources::lister(&source, page).await
}

#[tauri::command]
async fn chercher(source: String, mot: String, page: u32) -> Result<sources::Sons, String> {
    sources::chercher(&source, &mot, page).await
}

/// Ok si le micro virtuel marche, sinon la raison, à afficher.
#[tauri::command]
fn etat_micro(micro: State<Micro>) -> Result<(), String> {
    micro.as_ref().map(|_| ()).map_err(Clone::clone)
}

#[tauri::command]
fn envoyer_au_micro(actif: bool, micro: State<Micro>) -> Result<(), String> {
    micro.as_ref().map_err(Clone::clone)?.envoyer_au_micro(actif)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Avant la fenêtre : le son de l'app doit être redirigé dès son premier lecteur.
    let micro: Micro = MicroVirtuel::demarrer();
    tauri::Builder::default()
        .manage(micro)
        .invoke_handler(tauri::generate_handler![lister, chercher, etat_micro, envoyer_au_micro])
        .build(tauri::generate_context!())
        .expect("erreur au lancement de l'application")
        .run(|app, evenement| {
            if let RunEvent::Exit = evenement {
                if let Ok(micro) = app.state::<Micro>().inner() {
                    micro.arreter();
                }
            }
        });
}
