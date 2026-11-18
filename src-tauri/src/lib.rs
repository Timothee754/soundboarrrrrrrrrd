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

/// Déconnexion, extinction ou Ctrl+C : même fermeture que la croix, pour remettre le vrai micro.
#[cfg(unix)]
fn fermer_proprement_sur_signal(app: tauri::AppHandle) {
    use tokio::signal::unix::{signal, SignalKind};
    tauri::async_runtime::spawn(async move {
        let (Ok(mut arret), Ok(mut ctrl_c)) = (signal(SignalKind::terminate()), signal(SignalKind::interrupt())) else {
            return;
        };
        tokio::select! {
            _ = arret.recv() => {}
            _ = ctrl_c.recv() => {}
        }
        app.exit(0);
    });
}

#[cfg(not(unix))]
fn fermer_proprement_sur_signal(_app: tauri::AppHandle) {}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Tout le son de l'app part dans la sortie du micro virtuel ; si elle n'existe pas,
    // le serveur audio retombe sur le casque. Posé ici, avant tout autre thread.
    unsafe { std::env::set_var("PULSE_SINK", "soundboard_sons") };
    tauri::Builder::default()
        // Un 2e lancement ramène la fenêtre existante, au lieu de casser son micro virtuel.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _dossier| {
            if let Some(fenetre) = app.get_webview_window("main") {
                let _ = fenetre.unminimize();
                let _ = fenetre.set_focus();
            }
        }))
        .invoke_handler(tauri::generate_handler![lister, chercher, etat_micro, envoyer_au_micro])
        .setup(|app| {
            let micro: Micro = MicroVirtuel::demarrer();
            app.manage(micro);
            fermer_proprement_sur_signal(app.handle().clone());
            // La fenêtre est créée après le micro : son premier son doit trouver la sortie virtuelle.
            tauri::WebviewWindowBuilder::from_config(app.handle(), &app.config().app.windows[0])?.build()?;
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("erreur au lancement de l'application")
        .run(|app, evenement| {
            if let RunEvent::Exit = evenement {
                if let Some(Ok(micro)) = app.try_state::<Micro>().as_deref() {
                    micro.arreter();
                }
            }
        });
}
