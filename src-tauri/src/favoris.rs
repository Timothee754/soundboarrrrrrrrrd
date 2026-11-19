//! Les favoris : sons téléchargés dans le dossier de l'app, utilisables sans internet.
//! `favoris.json` garde l'ordre et les titres ; chaque son est un fichier à côté.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;

// Assez pour un long son ou une musique, pas assez pour remplir le disque par erreur.
const TAILLE_MAX: usize = 50 * 1024 * 1024;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct Favori {
    pub titre: String,
    /// Adresse d'origine, pour savoir si un résultat de recherche est déjà en favori.
    pub url: String,
    /// Nom du fichier dans le dossier des sons.
    pub fichier: String,
}

pub struct Favoris {
    dossier: PathBuf,
    // Deux ajouts rapides ne doivent pas écraser la liste l'un de l'autre.
    verrou: Mutex<()>,
}

impl Favoris {
    pub fn new(dossier: PathBuf) -> Self {
        Favoris { dossier, verrou: Mutex::new(()) }
    }

    pub fn lister(&self) -> Result<Vec<Favori>, String> {
        let _verrou = self.verrou.lock().unwrap();
        self.lire()
    }

    pub async fn ajouter(&self, titre: String, url: String) -> Result<Favori, String> {
        if !url.starts_with("https://") && !url.starts_with("http://") {
            return Err(format!("adresse refusée : {url}"));
        }
        if let Some(deja) = self.lister()?.into_iter().find(|f| f.url == url) {
            return Ok(deja);
        }
        let octets = reqwest::Client::new()
            .get(&url)
            .header("User-Agent", "Mozilla/5.0")
            .send()
            .await
            .and_then(|r| r.error_for_status())
            .map_err(|e| e.to_string())?
            .bytes()
            .await
            .map_err(|e| e.to_string())?;
        if octets.len() > TAILLE_MAX {
            return Err("son trop gros (plus de 50 Mo)".into());
        }

        let _verrou = self.verrou.lock().unwrap();
        let mut liste = self.lire()?;
        let horodatage = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|e| e.to_string())?
            .as_millis();
        let fichier = format!("{horodatage}.{}", extension(&url));
        std::fs::create_dir_all(&self.dossier).map_err(|e| e.to_string())?;
        std::fs::write(self.dossier.join(&fichier), &octets).map_err(|e| e.to_string())?;
        let favori = Favori { titre, url, fichier };
        liste.push(favori.clone());
        self.ecrire(&liste)?;
        Ok(favori)
    }

    /// Le contenu d'un son, pour le lire dans la fenêtre (seulement un fichier de la liste).
    pub fn lire_son(&self, fichier: &str) -> Result<Vec<u8>, String> {
        let liste = self.lister()?;
        let favori = liste.iter().find(|f| f.fichier == fichier).ok_or("favori introuvable")?;
        std::fs::read(self.dossier.join(&favori.fichier)).map_err(|e| e.to_string())
    }

    pub fn retirer(&self, fichier: &str) -> Result<(), String> {
        let _verrou = self.verrou.lock().unwrap();
        let mut liste = self.lire()?;
        // Seul un fichier de la liste peut être supprimé : pas de chemin venu de l'extérieur.
        let position = liste.iter().position(|f| f.fichier == fichier).ok_or("favori introuvable")?;
        let retire = liste.remove(position);
        self.ecrire(&liste)?;
        let _ = std::fs::remove_file(self.dossier.join(&retire.fichier));
        Ok(())
    }

    fn lire(&self) -> Result<Vec<Favori>, String> {
        let texte = match std::fs::read_to_string(self.index()) {
            Ok(texte) => texte,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
            Err(e) => return Err(e.to_string()),
        };
        serde_json::from_str(&texte).map_err(|e| format!("favoris.json illisible : {e}"))
    }

    /// Écrit dans un fichier temporaire puis le renomme : une coupure ne laisse jamais une liste à moitié écrite.
    fn ecrire(&self, liste: &[Favori]) -> Result<(), String> {
        std::fs::create_dir_all(&self.dossier).map_err(|e| e.to_string())?;
        let temporaire = self.dossier.join("favoris.json.tmp");
        let texte = serde_json::to_string_pretty(liste).map_err(|e| e.to_string())?;
        std::fs::write(&temporaire, texte).map_err(|e| e.to_string())?;
        std::fs::rename(&temporaire, self.index()).map_err(|e| e.to_string())
    }

    fn index(&self) -> PathBuf {
        self.dossier.join("favoris.json")
    }
}

/// Extension du fichier d'après l'adresse (`mp3` par défaut).
fn extension(url: &str) -> &str {
    url.rsplit('/')
        .next()
        .and_then(|nom| nom.split(['?', '#']).next())
        .and_then(|nom| nom.rsplit_once('.'))
        .map(|(_, ext)| ext)
        .filter(|ext| (1..=4).contains(&ext.len()) && ext.chars().all(|c| c.is_ascii_alphanumeric()))
        .unwrap_or("mp3")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn devine_l_extension() {
        assert_eq!(extension("https://www.myinstants.com/media/sounds/bruh.mp3"), "mp3");
        assert_eq!(extension("https://a.b/son.ogg?x=1"), "ogg");
        assert_eq!(extension("https://a.b/sans-extension"), "mp3");
        assert_eq!(extension("https://a.b/x.../../etc"), "mp3");
    }

    #[test]
    fn retire_un_favori_et_son_fichier() {
        let dossier = std::env::temp_dir().join(format!("soundboard-test-{}", std::process::id()));
        let favoris = Favoris::new(dossier.clone());
        assert_eq!(favoris.lister().unwrap(), vec![]);

        std::fs::create_dir_all(&dossier).unwrap();
        std::fs::write(dossier.join("1.mp3"), b"son").unwrap();
        let un = Favori { titre: "Bruh".into(), url: "https://a.b/bruh.mp3".into(), fichier: "1.mp3".into() };
        favoris.ecrire(&[un]).unwrap();
        assert_eq!(favoris.lire_son("1.mp3").unwrap(), b"son");

        assert!(favoris.lire_son("../../etc/passwd").is_err());
        assert!(favoris.retirer("../../etc/passwd").is_err());
        favoris.retirer("1.mp3").unwrap();
        assert_eq!(favoris.lister().unwrap(), vec![]);
        assert!(!dossier.join("1.mp3").exists());
        std::fs::remove_dir_all(dossier).unwrap();
    }
}
