const { invoke } = window.__TAURI__.core;

const liste = document.querySelector("#resultats");
const grille = document.querySelector("#grille");
const favorisVide = document.querySelector("#favoris-vide");
const sectionChercher = document.querySelector("#chercher");
const etat = document.querySelector("#etat");
const ecoute = new Audio();
const boutonStop = document.querySelector("#lecture-stop");
const boutonPause = document.querySelector("#lecture-pause");
const boutonRejouer = document.querySelector("#lecture-rejouer");
const barreTitre = document.querySelector("#lecture-titre");
const progression = document.querySelector("#lecture-progression");
const barre = document.querySelector("#lecture");

const SOURCE = "myinstants";

// Le son qui joue : `element` (ligne ou tuile) pour la surbrillance, `bouton` celui qui l'a lancé.
let lectureEnCours = null;
let favoris = []; // [{ titre, url, fichier }]
const sonsEnMemoire = new Map(); // fichier → adresse blob:, chargée au premier clic

async function adresseFavori(fichier) {
  if (!sonsEnMemoire.has(fichier)) {
    const octets = await invoke("lire_favori", { fichier });
    sonsEnMemoire.set(fichier, URL.createObjectURL(new Blob([octets])));
  }
  return sonsEnMemoire.get(fichier);
}

// ---------- Onglets ----------

let rechercheLancee = false;

function ouvrirOnglet(nom) {
  for (const bouton of document.querySelectorAll("#onglets button")) {
    bouton.setAttribute("aria-pressed", bouton.dataset.onglet === nom);
  }
  document.querySelector("#favoris").hidden = nom !== "favoris";
  sectionChercher.hidden = nom !== "chercher";
  document.querySelector("#recherche").hidden = nom !== "chercher";
  etat.textContent = "";
  if (nom === "chercher") {
    if (!rechercheLancee) {
      rechercheLancee = true;
      recommencer();
    }
    document.querySelector("#mot").focus();
  }
}

for (const bouton of document.querySelectorAll("#onglets button")) {
  bouton.onclick = () => ouvrirOnglet(bouton.dataset.onglet);
}

// ---------- Favoris ----------

async function chargerFavoris() {
  try {
    favoris = await invoke("favoris");
  } catch (e) {
    etat.textContent = `Favoris illisibles : ${e}`;
  }
  grille.replaceChildren(...favoris.map(tuile));
  favorisVide.hidden = favoris.length > 0;
  for (const plus of liste.querySelectorAll(".btn-ajout")) marquerAjout(plus);
}

// Une tuile : un clic l'envoie dans le micro (ce sont des sons déjà choisis) ; 🎧 pour écouter seul.
function tuile(favori) {
  const div = document.createElement("div");
  div.className = "tuile";
  div.dataset.titre = favori.titre;
  const src = () => adresseFavori(favori.fichier);

  const envoyer = document.createElement("button");
  envoyer.className = "tuile-envoyer";
  envoyer.textContent = favori.titre;
  envoyer.setAttribute("aria-label", `Envoyer ${favori.titre} dans le micro`);
  envoyer.onclick = () => basculer(div, envoyer, src, true);

  const ecouter = document.createElement("button");
  ecouter.className = "tuile-ecouter btn-ecoute";
  ecouter.dataset.icone = "🎧";
  ecouter.dataset.action = "Écouter";
  remettreBouton(ecouter, div);
  ecouter.onclick = () => basculer(div, ecouter, src, false);

  // Deux clics pour retirer : un seul clic de travers ne supprime rien.
  const retirer = document.createElement("button");
  retirer.className = "tuile-retirer";
  retirer.textContent = "✕";
  retirer.setAttribute("aria-label", `Retirer ${favori.titre} des favoris`);
  retirer.onclick = async () => {
    if (!retirer.classList.contains("confirmer")) {
      retirer.classList.add("confirmer");
      retirer.textContent = "Retirer ?";
      setTimeout(() => {
        retirer.classList.remove("confirmer");
        retirer.textContent = "✕";
      }, 3000);
      return;
    }
    if (lectureEnCours?.element === div) arreter();
    try {
      await invoke("retirer_favori", { fichier: favori.fichier });
      URL.revokeObjectURL(sonsEnMemoire.get(favori.fichier));
      sonsEnMemoire.delete(favori.fichier);
    } catch (e) {
      etat.textContent = `Impossible de retirer : ${e}`;
    }
    chargerFavoris();
  };

  div.append(envoyer, ecouter, retirer);
  return div;
}

// ＋ dans la recherche : devient ✓ quand le son est déjà en favori.
function boutonAjout(titre, url) {
  const plus = document.createElement("button");
  plus.className = "btn-ajout";
  plus.dataset.url = url;
  plus.dataset.titre = titre;
  marquerAjout(plus);
  plus.onclick = async () => {
    plus.disabled = true;
    plus.textContent = "…";
    try {
      await invoke("ajouter_favori", { titre, url });
    } catch (e) {
      etat.textContent = `Impossible d'ajouter « ${titre} » : ${e}`;
    }
    chargerFavoris();
  };
  return plus;
}

function marquerAjout(plus) {
  const deja = favoris.some((f) => f.url === plus.dataset.url);
  plus.textContent = deja ? "✓" : "＋";
  plus.disabled = deja;
  plus.setAttribute("aria-label", `${deja ? "Déjà dans les favoris" : "Ajouter aux favoris"} : ${plus.dataset.titre}`);
}

// ---------- Recherche ----------

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
  // La liste ne remplit pas encore l'écran : on charge la suite (seulement si on la voit).
  if (!finie && !sectionChercher.hidden && document.body.scrollHeight <= innerHeight) pageSuivante();
}

// micro = false : ▶ dans le casque seulement ; true : 🎤 aussi dans le micro virtuel.
function boutonLecture(li, url, micro) {
  const bouton = document.createElement("button");
  bouton.className = micro ? "btn-micro" : "btn-ecoute";
  bouton.dataset.icone = micro ? "🎤" : "▶";
  bouton.dataset.action = micro ? "Envoyer dans le micro" : "Écouter";
  remettreBouton(bouton, li);
  bouton.onclick = () => basculer(li, bouton, url, micro);
  return bouton;
}

function ligne(titre, url) {
  const li = document.createElement("li");
  li.dataset.titre = titre;
  const texte = document.createElement("span");
  texte.className = "titre";
  texte.textContent = titre;
  li.append(boutonLecture(li, url, false), texte, boutonAjout(titre, url), boutonLecture(li, url, true));
  return li;
}

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
  if (!sectionChercher.hidden && innerHeight + scrollY >= document.body.scrollHeight - 200) pageSuivante();
});

// ---------- Lecture ----------

let dernier = null; // le dernier son joué, pour ↻ Rejouer

// Sur le bouton en cours : il reprend si en pause, arrête sinon ; ailleurs, il lance le son.
function basculer(element, bouton, url, micro) {
  if (lectureEnCours?.bouton !== bouton) jouer(element, bouton, url, micro);
  else if (ecoute.paused) ecoute.play();
  else arreter();
}

// Les boutons à icône (▶ 🎤 🎧) affichent ■ pendant la lecture ; les tuiles gardent leur titre.
function remettreBouton(bouton, element) {
  if (!bouton.dataset.icone) return;
  bouton.textContent = bouton.dataset.icone;
  bouton.setAttribute("aria-label", `${bouton.dataset.action} ${element.dataset.titre}`);
}

// url : une adresse, ou une fonction qui la donne (favoris, lus en mémoire au premier clic).
async function jouer(element, bouton, url, micro) {
  try {
    if (typeof url === "function") url = await url();
  } catch (e) {
    etat.textContent = `Impossible de lire « ${element.dataset.titre} » : ${e}`;
    return;
  }
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
  dernier = { element, bouton, url, micro };
  boutonRejouer.disabled = false;
  lectureEnCours = { element, bouton };
  element.classList.add("en-cours");
  element.classList.toggle("en-direct", micro);
  barre.classList.toggle("en-direct", micro);
  afficherPause(false);
  barreTitre.textContent = `${micro ? "🎤 Dans le micro" : "🎧 Écoute"} : ${element.dataset.titre}`;
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
  barre.classList.remove("en-direct");
  if (!lectureEnCours) return;
  const { element, bouton } = lectureEnCours;
  element.classList.remove("en-cours", "en-direct");
  element.style.removeProperty("--progression");
  remettreBouton(bouton, element);
  lectureEnCours = null;
}

ecoute.onended = arreter;
ecoute.onerror = () => {
  if (!lectureEnCours) return;
  etat.textContent = `Impossible de lire « ${lectureEnCours.element.dataset.titre} ».`;
  arreter();
};
ecoute.ontimeupdate = () => {
  progression.value = ecoute.duration ? ecoute.currentTime / ecoute.duration : 0;
  // La tuile se remplit pendant la lecture.
  lectureEnCours?.element.style.setProperty("--progression", `${progression.value * 100}%`);
};
boutonStop.onclick = arreter;
boutonRejouer.onclick = () => dernier && jouer(dernier.element, dernier.bouton, dernier.url, dernier.micro);
// Clic ou glissement sur la barre : saute à ce moment du son.
progression.oninput = () => {
  if (ecoute.duration) ecoute.currentTime = progression.value * ecoute.duration;
};

function afficherPause(enPause) {
  boutonPause.textContent = enPause ? "▶" : "⏸";
  boutonPause.setAttribute("aria-label", enPause ? "Reprendre" : "Pause");
  if (!lectureEnCours?.bouton.dataset.icone) return;
  const { element, bouton } = lectureEnCours;
  bouton.textContent = enPause ? bouton.dataset.icone : "■";
  bouton.setAttribute("aria-label", `${enPause ? "Reprendre" : "Arrêter"} ${element.dataset.titre}`);
}

// Suit l'état réel du lecteur ; ignoré après arreter(), qui remet tout lui-même.
ecoute.onplay = () => lectureEnCours && afficherPause(false);
ecoute.onpause = () => lectureEnCours && afficherPause(true);
boutonPause.onclick = () => (ecoute.paused ? ecoute.play() : ecoute.pause());

// ---------- Démarrage ----------

await chargerFavoris();
// Premier lancement sans favori : on montre directement la recherche.
ouvrirOnglet(favoris.length ? "favoris" : "chercher");
// Après l'ouverture de l'onglet, qui efface les messages.
invoke("etat_micro").catch((e) => (etat.textContent = `Micro virtuel indisponible : ${e}`));
