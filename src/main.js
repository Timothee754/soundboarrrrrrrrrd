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

// Jolies couleurs vives dans un ordre mélangé, reprises en boucle de box en box.
const COULEURS = ["#14b8a6", "#ec4899", "#f59e0b", "#3b82f6", "#f97316", "#22c55e", "#8b5cf6", "#ef4444", "#06b6d4", "#d946ef"];

const ICONES = {
  debut: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.5 8c-2.65 0-5.05 1-6.9 2.6L2 7v9h9l-3.62-3.62A7.95 7.95 0 0 1 12.5 10.5c3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/></svg>',
  micro: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
  casque: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 0 0-9 9v7a2 2 0 0 0 2 2h3v-8H5v-1a7 7 0 0 1 14 0v1h-3v8h3a2 2 0 0 0 2-2v-7a9 9 0 0 0-9-9z"/></svg>',
  stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6h12v12H6z"/></svg>',
};

const durees = new Map(); // clé du son → durée en secondes, connue après le premier play

// Une box, au design des pads : en haut la progression (écoulé, curseur, restant), le titre
// et un bouton en coin propre à l'onglet (＋ ou ✕, donné par `extra`), en bas ↶ ▶ 🎧.
// ▶ envoie dans le micro (et le casque) ; 🎧 joue dans le casque seulement.
function boite(titre, url, cle, numero, extra) {
  const li = document.createElement("li");
  li.className = "boite";
  li.dataset.titre = titre;
  li.dataset.cle = cle;
  li.style.setProperty("--c", COULEURS[numero % COULEURS.length]);

  const haut = document.createElement("div");
  haut.className = "boite-haut";
  const ecoule = document.createElement("span");
  ecoule.className = "t-ecoule";
  const curseur = document.createElement("input");
  curseur.className = "boite-progression";
  curseur.type = "range";
  curseur.min = 0;
  curseur.max = 1;
  curseur.step = 0.001;
  curseur.setAttribute("aria-label", `Progression : ${titre}`);
  // Clic ou glissement : saute à ce moment du son (seulement celui qui joue).
  curseur.oninput = () => {
    if (lectureEnCours?.boite === li && ecoute.duration) ecoute.currentTime = curseur.value * ecoute.duration;
  };
  const reste = document.createElement("span");
  reste.className = "t-reste";
  haut.append(ecoule, curseur, reste);

  const corps = document.createElement("div");
  corps.className = "boite-corps";
  const nom = document.createElement("span");
  nom.className = "boite-titre";
  nom.textContent = titre;
  corps.append(nom, extra(li));

  const bas = document.createElement("div");
  bas.className = "boite-bas";
  const debut = document.createElement("button");
  debut.className = "btn-debut";
  debut.innerHTML = ICONES.debut;
  debut.setAttribute("aria-label", `Revenir au début : ${titre}`);
  debut.onclick = () => {
    if (lectureEnCours?.boite === li) ecoute.currentTime = 0;
  };
  bas.append(debut, boutonLecture(li, url, true), boutonLecture(li, url, false));

  li.append(haut, corps, bas);
  afficherTemps(li, 0);
  return li;
}

function boutonLecture(li, url, micro) {
  const bouton = document.createElement("button");
  bouton.className = micro ? "btn-micro" : "btn-casque";
  bouton.dataset.icone = micro ? "micro" : "casque";
  bouton.dataset.action = micro ? "Envoyer dans le micro" : "Écouter dans le casque";
  remettreBouton(bouton, li);
  bouton.onclick = () => (lectureEnCours?.bouton === bouton ? arreter() : jouer(li, bouton, url, micro));
  return bouton;
}

function remettreBouton(bouton, li) {
  bouton.innerHTML = ICONES[bouton.dataset.icone];
  bouton.setAttribute("aria-label", `${bouton.dataset.action} : ${li.dataset.titre}`);
}

// Temps écoulé à gauche, restant à droite (« --.- » tant que la durée est inconnue).
function afficherTemps(li, ecoule) {
  const duree = durees.get(li.dataset.cle);
  li.querySelector(".t-ecoule").textContent = ecoule.toFixed(1);
  li.querySelector(".t-reste").textContent = duree ? `-${Math.max(duree - ecoule, 0).toFixed(1)}` : "--.-";
  const curseur = li.querySelector(".boite-progression");
  curseur.value = duree ? ecoule / duree : 0;
  curseur.disabled = lectureEnCours?.boite !== li;
  li.querySelector(".btn-debut").disabled = lectureEnCours?.boite !== li;
}

// ---------- Favoris ----------

async function chargerFavoris() {
  try {
    favoris = await invoke("favoris");
  } catch (e) {
    etat.textContent = `Favoris illisibles : ${e}`;
  }
  grille.replaceChildren(
    ...favoris.map((f, i) => boite(f.titre, () => adresseFavori(f.fichier), `fav:${f.fichier}`, i, (li) => boutonRetirer(f, li))),
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
    for (const [titre, url] of sons) {
      liste.append(boite(titre, url, url, liste.children.length, () => boutonAjout(titre, url)));
    }
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
  bouton.innerHTML = ICONES.stop;
  bouton.setAttribute("aria-label", `Arrêter : ${li.dataset.titre}`);
  afficherTemps(li, 0);
  ecoute.src = url;
  ecoute.play().catch(() => {}); // les erreurs de lecture passent par ecoute.onerror
}

function arreter() {
  ecoute.pause();
  if (!lectureEnCours) return;
  const { boite, bouton } = lectureEnCours;
  boite.classList.remove("en-cours", "en-direct");
  remettreBouton(bouton, boite);
  lectureEnCours = null;
  afficherTemps(boite, 0);
}

ecoute.onended = arreter;
ecoute.onerror = () => {
  if (!lectureEnCours) return;
  etat.textContent = `Impossible de lire « ${lectureEnCours.boite.dataset.titre} ».`;
  arreter();
};
// La durée est retenue pour l'afficher aussi quand le son ne joue plus.
ecoute.onloadedmetadata = () => {
  if (lectureEnCours && Number.isFinite(ecoute.duration)) durees.set(lectureEnCours.boite.dataset.cle, ecoute.duration);
};
ecoute.ontimeupdate = () => lectureEnCours && afficherTemps(lectureEnCours.boite, ecoute.currentTime);

// ---------- Démarrage ----------

await chargerFavoris();
// Premier lancement sans favori : on montre directement la recherche.
ouvrirOnglet(favoris.length ? "favoris" : "chercher");
// Après l'ouverture de l'onglet, qui efface les messages.
invoke("etat_micro").catch((e) => (etat.textContent = `Micro virtuel indisponible : ${e}`));
