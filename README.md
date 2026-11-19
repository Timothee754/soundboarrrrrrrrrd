# Soundboarrrrrrrrrd

Soundboard de bureau pour envoyer des sons de mèmes dans ton micro pendant une partie : tes potes les entendent dans le jeu ou sur Discord.

> **Statut : pré-release Linux (v0.1.0).** L'essentiel marche ; il manque encore des réglages et l'interface va évoluer. Windows et macOS : pas encore.

## Ce qui marche

- **Chercher** et écouter les sons de [myinstants](https://www.myinstants.com/en/index/fr/).
- **▶** écoute un son dans ton casque seulement ; **🎤** l'envoie dans le micro (tes potes l'entendent, en plus de ta voix).
- **＋** ajoute un son à tes **⭐ Favoris** : il est téléchargé sur ton PC et marche même sans internet. Un clic sur une tuile l'envoie dans le micro, 🎧 l'écoute seul.
- Barre de lecture : progression cliquable, pause, rejouer, stop.

## Installation (Linux)

Télécharge le fichier de ta distribution dans [Releases](https://github.com/Timothee754/soundboarrrrrrrrrd/releases) :

| Distribution | Fichier | Commande |
|---|---|---|
| Fedora, openSUSE… | `.rpm` | `sudo dnf install ./Soundboarrrrrrrrrd-*.rpm` |
| Ubuntu, Debian, Mint… | `.deb` | `sudo apt install ./Soundboarrrrrrrrrd_*.deb` |
| Toutes | `.AppImage` | `chmod +x Soundboarrrrrrrrrd_*.AppImage` puis double-clic |

Il faut **PipeWire ou PulseAudio** avec la commande `pactl` (présente par défaut sur les distributions récentes ; sinon paquet `pulseaudio-utils`).

L'app n'est pas signée : c'est normal qu'aucun éditeur ne soit affiché.

## Utilisation avec Discord ou un jeu

1. Lance l'app : elle crée le micro **« Micro Soundboard »** et le met en micro par défaut.
2. Dans Discord (*Paramètres → Voix et vidéo*) ou dans le jeu, choisis **« Par défaut »** ou **« Micro Soundboard »**.
3. Dans Discord, mets la **suppression du bruit** sur *Standard* ou *Aucune* : *Krisp* efface les sons.
4. Ferme l'app : ton vrai micro redevient celui par défaut, rien ne reste sur le système.

Ta voix passe toujours par « Micro Soundboard » (le micro utilisé est ton micro par défaut au lancement).

## Pas encore là

- Choisir le micro de ta voix dans l'app, et couper le retour des sons dans le casque.
- Importer tes propres MP3.
- Raccourcis clavier, musiques (YouTube…), Windows et macOS.

## Comment ça marche

Un logiciel ne peut pas injecter de son dans un vrai micro. L'app passe donc par un micro virtuel qui mélange ta voix et les sons :

```
Ton micro ────┐
              ├──► « Micro Soundboard » ──► jeu / Discord
Les sons ─────┘
```

| Système | Micro virtuel |
|---|---|
| Linux | Créé automatiquement par l'app (PipeWire ou PulseAudio) |
| Windows (à venir) | [VB-Cable](https://vb-audio.com/Cable/) à installer (gratuit), puis « CABLE Output » comme micro dans Discord ou le jeu |
| macOS (à venir) | [BlackHole](https://github.com/ExistentialAudio/BlackHole) à installer (gratuit) |

## Technique

[Tauri](https://tauri.app/) : cœur en Rust, interface en HTML/CSS/JS.

```
npm install
npm run tauri dev                          # lancer en développement
cd src-tauri && cargo test                 # tests
npm run tauri build -- --bundles rpm,deb,appimage
```

## Droits

Les sons de myinstants sont envoyés par ses utilisateurs et souvent protégés par le droit d'auteur. Usage personnel uniquement.
