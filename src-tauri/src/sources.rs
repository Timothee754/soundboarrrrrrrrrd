//! Les sources de sons. Une source = un fichier `sources/<nom>.rs` avec `lister(page)`
//! et `chercher(mot, page)`, qui renvoient des (titre, url) que la fenêtre sait lire.
//! Ajouter une source (yt-dlp, autre site…) = un fichier + une ligne dans chaque `match`.
//! Le micro virtuel reçoit tout ce que l'app joue : il ne dépend d'aucune source.

mod myinstants;

pub type Sons = Vec<(String, String)>;

pub async fn lister(source: &str, page: u32) -> Result<Sons, String> {
    match source {
        "myinstants" => myinstants::lister(page).await,
        _ => Err(format!("source inconnue : {source}")),
    }
}

pub async fn chercher(source: &str, mot: &str, page: u32) -> Result<Sons, String> {
    match source {
        "myinstants" => myinstants::chercher(mot, page).await,
        _ => Err(format!("source inconnue : {source}")),
    }
}
