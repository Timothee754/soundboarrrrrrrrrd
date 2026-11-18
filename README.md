# Soundboarrrrrrrrrd

Soundboard de bureau pour envoyer des sons de mèmes dans ton micro pendant une partie : tes potes les entendent dans le jeu ou sur Discord.

> **Statut : en conception.** Rien n'est encore utilisable.

## Fonctionnalités prévues

- Chercher et écouter les sons de [myinstants](https://www.myinstants.com/en/index/fr/), puis les ajouter à ta soundboard en un clic.
- Importer tes propres MP3 (bouton ou glisser-déposer).
- Un clic sur un son l'envoie dans le micro, en plus de ta voix.
- Interrupteur « M'entendre » pour entendre ou non les sons dans ton casque.

## Comment ça marche

Un logiciel ne peut pas injecter de son dans un vrai micro. L'app passe donc par un micro virtuel qui mélange ta voix et les sons :

```
Ton micro ────┐
              ├──► micro virtuel ──► jeu / Discord
Les sons ─────┘
```

## Plateformes

| Système | Micro virtuel |
|---|---|
| Linux | Créé automatiquement par l'app (PipeWire) |
| Windows | Installer [VB-Cable](https://vb-audio.com/Cable/) (gratuit), puis choisir « CABLE Output » comme micro dans Discord ou le jeu |
| macOS | Installer [BlackHole](https://github.com/ExistentialAudio/BlackHole) (gratuit) |

Linux d'abord ; Windows et macOS ensuite.

## Technique

[Tauri](https://tauri.app/) : cœur en Rust, interface en HTML/CSS/JS.

## Droits

Les sons de myinstants sont envoyés par ses utilisateurs et souvent protégés par le droit d'auteur. Usage personnel uniquement.
