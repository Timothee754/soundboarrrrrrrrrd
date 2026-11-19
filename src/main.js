const { invoke } = window.__TAURI__.core;

const liste = document.querySelector("#resultats");
const grille = document.querySelector("#grille");
const favorisVide = document.querySelector("#favoris-vide");
const sectionChercher = document.querySelector("#chercher");
const etat = document.querySelector("#etat");
const ecoute = new Audio();

const SOURCE = "myinstants";

// Le son qui joue : sa `boite` (surbrillance, remplissage) et le `bouton` qui l'a lancé.
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

// ---------- Box d'un son ----------

// Une box : le titre, 🎧 (casque seulement) à gauche, 🎤 (micro + casque) à droite,
// et un bouton en coin propre à l'onglet (＋ ou ✕), donné par `extra(boite)`.
function boite(titre, url, extra) {
  const li = document.createElement("li");
  li.className = "boite";
  li.dataset.titre = titre;
  const nom = document.createElement("span");
  nom.className = "boite-titre";
  nom.textContent = titre;
  li.append(nom, extra(li), boutonLecture(li, url, false), boutonLecture(li, url, true));
  return li;
}

function boutonLecture(li, url, micro) {
  const bouton = document.createElement("button");
  bouton.className = micro ? "btn-micro" : "btn-ecoute";
  bouton.dataset.icone = micro ? "🎤" : "🎧";
  bouton.dataset.action = micro ? "Envoyer dans le micro" : "Écouter dans le casque";
  remettreBouton(bouton, li);
  bouton.onclick = () => (lectureEnCours?.bouton === bouton ? arreter() : jouer(li, bouton, url, micro));
  return bouton;
}

function remettreBouton(bouton, li) {
  bouton.textContent = bouton.dataset.icone;
  bouton.setAttribute("aria-label", `${bouton.dataset.action} : ${li.dataset.titre}`);
}

// ---------- Favoris ----------

async function chargerFavoris() {
  try {
    favoris = await invoke("favoris");
  } catch (e) {
    etat.textContent = `Favoris illisibles : ${e}`;
  }
  grille.replaceChildren(
    ...favoris.map((f) => boite(f.titre, () => adresseFavori(f.fichier), (li) => boutonRetirer(f, li))),
  );
  favorisVide.hidden = favoris.length > 0;
  for (const plus of liste.querySelectorAll(".btn-ajout")) marquerAjout(plus);
}

// Deux clics pour retirer : un seul clic de travers ne supprime rien.
function boutonRetirer(favori, li) {
  const retirer = document.createElement("button");
  retirer.className = "btn-coin btn-retirer";
  retirer.textContent = "✕";
  retirer.setAttribute("aria-label", `Retirer des favoris : ${favori.titre}`);
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
    if (lectureEnCours?.boite === li) arreter();
    try {
      await invoke("retirer_favori", { fichier: favori.fichier });
      URL.revokeObjectURL(sonsEnMemoire.get(favori.fichier));
      sonsEnMemoire.delete(favori.fichier);
    } catch (e) {
      etat.textContent = `Impossible de retirer : ${e}`;
    }
    chargerFavoris();
  };
  return retirer;
}

// ＋ dans la recherche : devient ✓ quand le son est déjà en favori.
function boutonAjout(titre, url) {
  const plus = document.createElement("button");
  plus.className = "btn-coin btn-ajout";
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
    for (const [titre, url] of sons) liste.append(boite(titre, url, () => boutonAjout(titre, url)));
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

// url : une adresse, ou une fonction qui la donne (favoris, lus en mémoire au premier clic).
async function jouer(li, bouton, url, micro) {
  try {
    if (typeof url === "function") url = await url();
  } catch (e) {
    etat.textContent = `Impossible de lire « ${li.dataset.titre} » : ${e}`;
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
  lectureEnCours = { boite: li, bouton };
  li.classList.add("en-cours");
  li.classList.toggle("en-direct", micro);
  bouton.textContent = "■";
  bouton.setAttribute("aria-label", `Arrêter : ${li.dataset.titre}`);
  ecoute.src = url;
  ecoute.play().catch(() => {}); // les erreurs de lecture passent par ecoute.onerror
}

function arreter() {
  ecoute.pause();
  if (!lectureEnCours) return;
  const { boite, bouton } = lectureEnCours;
  boite.classList.remove("en-cours", "en-direct");
  boite.style.removeProperty("--progression");
  remettreBouton(bouton, boite);
  lectureEnCours = null;
}

ecoute.onended = arreter;
ecoute.onerror = () => {
  if (!lectureEnCours) return;
  etat.textContent = `Impossible de lire « ${lectureEnCours.boite.dataset.titre} ».`;
  arreter();
};
// La box se remplit pendant la lecture.
ecoute.ontimeupdate = () => {
  const avance = ecoute.duration ? ecoute.currentTime / ecoute.duration : 0;
  lectureEnCours?.boite.style.setProperty("--progression", `${avance * 100}%`);
};

// ---------- Démarrage ----------

await chargerFavoris();
// Premier lancement sans favori : on montre directement la recherche.
ouvrirOnglet(favoris.length ? "favoris" : "chercher");
// Après l'ouverture de l'onglet, qui efface les messages.
invoke("etat_micro").catch((e) => (etat.textContent = `Micro virtuel indisponible : ${e}`));
