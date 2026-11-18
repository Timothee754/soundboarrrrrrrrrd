//! Micro virtuel : seul module propre à chaque système.
//!
//! Linux (PipeWire ou PulseAudio, via `pactl`) :
//! ```text
//! son de l'app ─► « soundboard_sons » ─┬─► casque (toujours)
//!                                      └─► « soundboard_mix » (seulement si envoyer_au_micro(true))
//! vrai micro ─────────────────────────────► « soundboard_mix »
//! « soundboard_mix » ─► « Micro Soundboard » (soundboard_micro), défini comme micro par défaut
//! ```
//! Tout le son de l'app part dans « soundboard_sons » grâce à PULSE_SINK, quelle que soit la source.

use std::sync::Mutex;

pub struct MicroVirtuel {
    modules: Vec<String>,
    ancien_micro: String,
    vers_micro: Mutex<Option<String>>,
}

#[cfg(target_os = "linux")]
impl MicroVirtuel {
    /// Crée le micro virtuel et le met par défaut. Nettoie d'abord les restes d'un plantage.
    pub fn demarrer() -> Result<Self, String> {
        nettoyer();
        let ancien_micro = pactl(&["get-default-source"])?;
        let mut micro = MicroVirtuel { modules: Vec::new(), ancien_micro, vers_micro: Mutex::new(None) };
        if let Err(e) = micro.creer() {
            micro.arreter();
            return Err(e);
        }
        // Avant le lancement de la fenêtre : aucun autre thread ne lit l'environnement.
        unsafe { std::env::set_var("PULSE_SINK", "soundboard_sons") };
        Ok(micro)
    }

    fn creer(&mut self) -> Result<(), String> {
        let vraie_voix = format!("source={}", self.ancien_micro);
        for args in [
            &["module-null-sink", "sink_name=soundboard_sons", r#"sink_properties=device.description="Sons Soundboard""#][..],
            &["module-null-sink", "sink_name=soundboard_mix", r#"sink_properties=device.description="Mix Soundboard""#],
            &["module-loopback", &vraie_voix, "sink=soundboard_mix", "latency_msec=20"],
            // Retour des sons dans le casque (sortie par défaut).
            &["module-loopback", "source=soundboard_sons.monitor", "latency_msec=20"],
            &[
                "module-remap-source",
                "master=soundboard_mix.monitor",
                "source_name=soundboard_micro",
                r#"source_properties=device.description="Micro Soundboard""#,
            ],
        ] {
            self.modules.push(charger(args)?);
        }
        // Juste après sa création, PipeWire ignore le micro virtuel quelques instants : on réessaie.
        for _ in 0..30 {
            pactl(&["set-default-source", "soundboard_micro"])?;
            std::thread::sleep(std::time::Duration::from_millis(100));
            if pactl(&["get-default-source"])? == "soundboard_micro" {
                return Ok(());
            }
        }
        Err("impossible de mettre « Micro Soundboard » par défaut".into())
    }

    /// Branche ou débranche les sons de l'app sur le micro virtuel.
    pub fn envoyer_au_micro(&self, actif: bool) -> Result<(), String> {
        let mut vers_micro = self.vers_micro.lock().unwrap();
        match (actif, vers_micro.take()) {
            (true, None) => {
                *vers_micro = Some(charger(&[
                    "module-loopback",
                    "source=soundboard_sons.monitor",
                    "sink=soundboard_mix",
                    "latency_msec=20",
                ])?)
            }
            (true, deja) => *vers_micro = deja,
            (false, Some(id)) => pactl(&["unload-module", &id]).map(|_| ())?,
            (false, None) => {}
        }
        Ok(())
    }

    /// Remet l'ancien micro par défaut et supprime tout ce que l'app a créé.
    pub fn arreter(&self) {
        if let Some(id) = self.vers_micro.lock().unwrap().take() {
            let _ = pactl(&["unload-module", &id]);
        }
        let _ = pactl(&["set-default-source", &self.ancien_micro]);
        for id in self.modules.iter().rev() {
            let _ = pactl(&["unload-module", id]);
        }
    }
}

// shortcut: Windows et macOS (VB-Cable, BlackHole) pas encore faits, à coder avec une machine de test.
#[cfg(not(target_os = "linux"))]
impl MicroVirtuel {
    pub fn demarrer() -> Result<Self, String> {
        Err("pas encore disponible sur ce système".into())
    }
    pub fn envoyer_au_micro(&self, _actif: bool) -> Result<(), String> {
        Ok(())
    }
    pub fn arreter(&self) {}
}

#[cfg(target_os = "linux")]
fn pactl(args: &[&str]) -> Result<String, String> {
    let sortie = std::process::Command::new("pactl")
        .args(args)
        .env("LC_ALL", "C")
        .output()
        .map_err(|e| format!("pactl introuvable : {e}"))?;
    if !sortie.status.success() {
        return Err(format!("pactl {} : {}", args.join(" "), String::from_utf8_lossy(&sortie.stderr).trim()));
    }
    Ok(String::from_utf8_lossy(&sortie.stdout).trim().to_string())
}

/// Charge un module et renvoie son numéro.
#[cfg(target_os = "linux")]
fn charger(args: &[&str]) -> Result<String, String> {
    pactl(&[&["load-module"][..], args].concat())
}

/// Décharge les modules laissés par un plantage précédent.
#[cfg(target_os = "linux")]
fn nettoyer() {
    if let Ok(liste) = pactl(&["list", "short", "modules"]) {
        for id in modules_a_nettoyer(&liste) {
            let _ = pactl(&["unload-module", id]);
        }
    }
}

/// Numéros des modules créés par l'app, d'après `pactl list short modules`.
fn modules_a_nettoyer(liste: &str) -> Vec<&str> {
    liste
        .lines()
        .filter(|l| l.contains("soundboard_"))
        .filter_map(|l| l.split('\t').next())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn retrouve_seulement_nos_modules() {
        let liste = "536870913\tmodule-null-sink\tsink_name=soundboard_sons sink_properties=x\n\
                     536870914\tmodule-loopback\tsource=alsa_input.usb latency_msec=20\n\
                     536870915\tmodule-remap-source\tmaster=soundboard_mix.monitor source_name=soundboard_micro\n\
                     12\tmodule-x11-bell\t";
        assert_eq!(modules_a_nettoyer(liste), vec!["536870913", "536870915"]);
    }
}
