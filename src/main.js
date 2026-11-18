const { invoke } = window.__TAURI__.core;

const liste = document.querySelector("#resultats");
const etat = document.querySelector("#etat");
const ecoute = new Audio();
const boutonStop = document.querySelector("#lecture-stop");
const boutonPause = document.querySelector("#lecture-pause");
const boutonRejouer = document.querySelector("#lecture-rejouer");
const barreTitre = document.querySelector("#lecture-titre");
const progression = document.querySelector("#lecture-progression");

let ligneEnCours = null; // la ligne du son qui joue, pour la surbrillance

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
      ? await invoke("chercher", { mot, page: page + 1 })
      : await invoke("lister", { page: page + 1 });
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

function ligne(titre, url) {
  const li = document.createElement("li");
  const bouton = document.createElement("button");
  li.dataset.titre = titre;
  bouton.textContent = "▶";
  bouton.setAttribute("aria-label", `Écouter ${titre}`);
  // Sur la ligne en cours : ▶ reprend si en pause, ■ arrête sinon.
  bouton.onclick = () =>
    ligneEnCours !== li ? jouer(li, url) : ecoute.paused ? ecoute.play() : arreter();
  li.append(bouton, titre);
  return li;
}

let dernier = null; // le dernier son joué, pour ↻ Rejouer

function jouer(li, url) {
  arreter();
  dernier = { li, url };
  boutonRejouer.disabled = false;
  ligneEnCours = li;
  li.classList.add("en-cours");
  const bouton = li.querySelector("button");
  bouton.textContent = "■";
  bouton.setAttribute("aria-label", `Arrêter ${li.dataset.titre}`);
  barreTitre.textContent = `🎧 Écoute : ${li.dataset.titre}`;
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
  afficherPause(false);
  if (!ligneEnCours) return;
  ligneEnCours.classList.remove("en-cours");
  const bouton = ligneEnCours.querySelector("button");
  bouton.textContent = "▶";
  bouton.setAttribute("aria-label", `Écouter ${ligneEnCours.dataset.titre}`);
  ligneEnCours = null;
}

ecoute.onended = arreter;
ecoute.onerror = () => {
  if (!ligneEnCours) return;
  etat.textContent = `Impossible de lire « ${ligneEnCours.dataset.titre} ».`;
  arreter();
};
ecoute.ontimeupdate = () => {
  progression.value = ecoute.duration ? ecoute.currentTime / ecoute.duration : 0;
};
boutonStop.onclick = arreter;
boutonRejouer.onclick = () => dernier && jouer(dernier.li, dernier.url);
// Clic ou glissement sur la barre : saute à ce moment du son.
progression.oninput = () => {
  if (ecoute.duration) ecoute.currentTime = progression.value * ecoute.duration;
};

function afficherPause(enPause) {
  boutonPause.textContent = enPause ? "▶" : "⏸";
  boutonPause.setAttribute("aria-label", enPause ? "Reprendre" : "Pause");
  if (!ligneEnCours) return;
  const bouton = ligneEnCours.querySelector("button");
  bouton.textContent = enPause ? "▶" : "■";
  bouton.setAttribute("aria-label", `${enPause ? "Reprendre" : "Arrêter"} ${ligneEnCours.dataset.titre}`);
}

// Suit l'état réel du lecteur ; ignoré après arreter(), qui remet ⏸ lui-même.
ecoute.onplay = () => afficherPause(false);
ecoute.onpause = () => ligneEnCours && afficherPause(true);
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

recommencer();
