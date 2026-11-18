const { invoke } = window.__TAURI__.core;

const liste = document.querySelector("#resultats");
const etat = document.querySelector("#etat");
const ecoute = new Audio();

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
  bouton.textContent = "▶";
  bouton.setAttribute("aria-label", `Écouter ${titre}`);
  bouton.onclick = () => {
    ecoute.src = url;
    ecoute.play();
  };
  li.append(bouton, titre);
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
  if (innerHeight + scrollY >= document.body.scrollHeight - 200) pageSuivante();
});

recommencer();
