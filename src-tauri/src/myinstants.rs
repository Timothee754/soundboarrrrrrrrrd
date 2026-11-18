//! Source de sons myinstants.com. Seul fichier qui connaît le site.

use regex::Regex;
use std::sync::LazyLock;

const SITE: &str = "https://www.myinstants.com";

// <button ... onclick="play('/media/sounds/x.mp3', ...)" title="Play <titre> sound">
static BOUTON: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r#"onclick="play\('(/media/sounds/[^']+)'[^"]*"\s+title="Play (.*?) sound""#).unwrap()
});

/// La liste FR, page par page (page = 1, 2, ...).
pub async fn lister(page: u32) -> Result<Vec<(String, String)>, String> {
    telecharger(&format!("{SITE}/en/index/fr/"), &[("page", page.to_string())]).await
}

/// Les résultats d'une recherche, page par page.
pub async fn chercher(mot: &str, page: u32) -> Result<Vec<(String, String)>, String> {
    telecharger(
        &format!("{SITE}/en/search/"),
        &[("name", mot.to_string()), ("page", page.to_string())],
    )
    .await
}

async fn telecharger(url: &str, params: &[(&str, String)]) -> Result<Vec<(String, String)>, String> {
    let reponse = reqwest::Client::new()
        .get(url)
        .query(params)
        // Seul User-Agent testé sur le site.
        .header("User-Agent", "Mozilla/5.0")
        .send()
        .await
        .map_err(|e| e.to_string())?;
    // Le site répond 404 après la dernière page et quand une recherche ne trouve rien.
    if reponse.status() == reqwest::StatusCode::NOT_FOUND {
        return Ok(Vec::new());
    }
    let html = reponse
        .error_for_status()
        .map_err(|e| e.to_string())?
        .text()
        .await
        .map_err(|e| e.to_string())?;
    Ok(lire_sons(&html))
}

/// Extrait les (titre, url du MP3) d'une page HTML.
pub fn lire_sons(html: &str) -> Vec<(String, String)> {
    BOUTON
        .captures_iter(html)
        .map(|c| (decoder_html(&c[2]), format!("{SITE}{}", &c[1])))
        .collect()
}

// Le site (Django) n'échappe que ces 5 caractères ; `&amp;` en dernier.
fn decoder_html(s: &str) -> String {
    s.replace("&#x27;", "'")
        .replace("&quot;", "\"")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&amp;", "&")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lit_la_page_fr_enregistree() {
        let sons = lire_sons(include_str!("../tests/myinstants_fr.html"));
        assert_eq!(sons.len(), 36);
        for (titre, url) in &sons {
            assert!(!titre.is_empty() && !titre.contains("&#x27;"), "titre mal lu : {titre}");
            assert!(url.starts_with("https://www.myinstants.com/media/sounds/") && url.ends_with(".mp3"), "url : {url}");
        }
    }

    #[test]
    fn decode_le_titre() {
        let html = r#"<button class="small-button" onclick="play('/media/sounds/cest-vrai_tNRnaW4.mp3', 'loader-649284', 'cest-vrai-54735')" title="Play C&#x27;est vrai ? sound" type="button">"#;
        assert_eq!(
            lire_sons(html),
            vec![("C'est vrai ?".into(), "https://www.myinstants.com/media/sounds/cest-vrai_tNRnaW4.mp3".into())]
        );
    }
}
