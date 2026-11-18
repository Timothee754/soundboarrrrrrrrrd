const { invoke } = window.__TAURI__.core;

const liste = document.querySelector("#resultats");
const etat = document.querySelector("#etat");
const ecoute = new Audio();
const boutonStop = document.querySelector("#lecture-stop");
const boutonPause = document.querySelector("#lecture-pause");
const boutonRejouer = document.querySelector("#lecture-rejouer");
const barreTitre = document.querySelector("#lecture-titre");
const progression = document.querySelector("#lecture-progression");

const SOURCE = "myinstants";

let lectureEnCours = null; // { li, bouton } du son qui joue, pour la surbrillance

let mot = "";
let page = 0;
let finie = false;
let enCours = false;
let generation = 0; // change à chaque nouvelle recherche, pour jeter les réponses périmées

async function pageSuivante() {
  if (enCours || finie) return;
  enCours = true;
  const g = generation;
  etat.textContent = "Chargement…";
  try {
    const sons = mot
      ? await invoke("chercher", { source: SOURCE, mot, page: page + 1 })
      : await invoke("lister", { source: SOURCE, page: page + 1 });
    if (g !== generation) return;
    page += 1;
    if (sons.length === 0) finie = true;
    for (const [titre, url] of sons) liste.append(ligne(titre, url));
    etat.textContent = finie && page === 1 ? "Aucun son trouvé." : "";
  } catch (e) {
    if (g !== generation) return;
    finie = true;
    etat.textContent = `Erreur : ${e}`;
  }
  enCours = false;
  // La page n'a pas encore de barre de défilement : on charge la suite.
  if (!finie && document.body.scrollHeight <= innerHeight) pageSuivante();
}

// micro = false : ▶ dans le casque seulement ; true : 🎤 aussi dans le micro virtuel.
function boutonLecture(li, url, micro) {
  const bouton = document.createElement("button");
  bouton.dataset.icone = micro ? "🎤" : "▶";
  bouton.dataset.action = micro ? "Envoyer dans le micro" : "Écouter";
  remettreBouton(bouton, li);
  // Sur le bouton en cours : il reprend si en pause, arrête sinon.
  bouton.onclick = () =>
    lectureEnCours?.bouton !== bouton
      ? jouer(li, bouton, url, micro)
      : ecoute.paused
        ? ecoute.play()
        : arreter();
  return bouton;
}

function remettreBouton(bouton, li) {
  bouton.textContent = bouton.dataset.icone;
  bouton.setAttribute("aria-label", `${bouton.dataset.action} ${li.dataset.titre}`);
}

function ligne(titre, url) {
  const li = document.createElement("li");
  li.dataset.titre = titre;
  li.append(boutonLecture(li, url, false), boutonLecture(li, url, true), titre);
  return li;
}

let dernier = null; // le dernier son joué, pour ↻ Rejouer

async function jouer(li, bouton, url, micro) {
  try {
    await invoke("envoyer_au_micro", { actif: micro });
  } catch (e) {
    // Sans micro virtuel, l'écoute marche quand même ; l'envoi dans le micro, non.
    if (micro) {
      etat.textContent = `Impossible d'envoyer dans le micro : ${e}`;
      return;
    }
  }
  // Après l'attente : si deux clics se croisent, le dernier arrivé nettoie l'affichage du premier.
  arreter();
  dernier = { li, bouton, url, micro };
  boutonRejouer.disabled = false;
  lectureEnCours = { li, bouton };
  li.classList.add("en-cours");
  afficherPause(false);
  barreTitre.textContent = `${micro ? "🎤 Dans le micro" : "🎧 Écoute"} : ${li.dataset.titre}`;
  progression.value = 0;
  progression.disabled = false;
  boutonStop.disabled = false;
  boutonPause.disabled = false;
  ecoute.src = url;
  ecoute.play().catch(() => {}); // les erreurs de lecture passent par ecoute.onerror
}

function arreter() {
  ecoute.pause();
  barreTitre.textContent = "Aucun son en cours";
  progression.value = 0;
  progression.disabled = true;
  boutonStop.disabled = true;
  boutonPause.disabled = true;
  boutonPause.textContent = "⏸";
  boutonPause.setAttribute("aria-label", "Pause");
  if (!lectureEnCours) return;
  lectureEnCours.li.classList.remove("en-cours");
  remettreBouton(lectureEnCours.bouton, lectureEnCours.li);
  lectureEnCours = null;
}

ecoute.onended = arreter;
ecoute.onerror = () => {
  if (!lectureEnCours) return;
  etat.textContent = `Impossible de lire « ${lectureEnCours.li.dataset.titre} ».`;
  arreter();
};
ecoute.ontimeupdate = () => {
  progression.value = ecoute.duration ? ecoute.currentTime / ecoute.duration : 0;
};
boutonStop.onclick = arreter;
boutonRejouer.onclick = () => dernier && jouer(dernier.li, dernier.bouton, dernier.url, dernier.micro);
// Clic ou glissement sur la barre : saute à ce moment du son.
progression.oninput = () => {
  if (ecoute.duration) ecoute.currentTime = progression.value * ecoute.duration;
};

function afficherPause(enPause) {
  boutonPause.textContent = enPause ? "▶" : "⏸";
  boutonPause.setAttribute("aria-label", enPause ? "Reprendre" : "Pause");
  if (!lectureEnCours) return;
  const { li, bouton } = lectureEnCours;
  bouton.textContent = enPause ? bouton.dataset.icone : "■";
  bouton.setAttribute("aria-label", `${enPause ? "Reprendre" : "Arrêter"} ${li.dataset.titre}`);
}

// Suit l'état réel du lecteur ; ignoré après arreter(), qui remet tout lui-même.
ecoute.onplay = () => lectureEnCours && afficherPause(false);
ecoute.onpause = () => lectureEnCours && afficherPause(true);
boutonPause.onclick = () => (ecoute.paused ? ecoute.play() : ecoute.pause());

function recommencer() {
  generation += 1;
  enCours = false;
  liste.replaceChildren();
  page = 0;
  finie = false;
  pageSuivante();
}

document.querySelector("#recherche").onsubmit = (e) => {
  e.preventDefault();
  mot = document.querySelector("#mot").value.trim();
  recommencer();
};

addEventListener("scroll", () => {
  if (innerHeight + scrollY >= document.body.scrollHeight - 200) pageSuivante();
});

invoke("etat_micro").catch((e) => (etat.textContent = `Micro virtuel indisponible : ${e}`));
recommencer();
