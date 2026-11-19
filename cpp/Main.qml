import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import QtQuick.Shapes
import QtMultimedia

ApplicationWindow {
    id: fenetre

    width: 720
    height: 640
    minimumWidth: 360
    minimumHeight: 400
    title: "Soundboarrrrrrrrrd"
    color: "#0f0d17"

    // Jolies couleurs vives dans un ordre mélangé, reprises en boucle de box en box.
    readonly property var couleurs: ["#14b8a6", "#ec4899", "#f59e0b", "#3b82f6", "#f97316", "#22c55e", "#8b5cf6", "#ef4444", "#06b6d4", "#d946ef"]

    // Icônes dessinées en blanc (un emoji 🎧 ne se recolore pas) : chemins SVG sur 24 × 24.
    readonly property var icones: ({
        debut: "M12.5 8c-2.65 0-5.05 1-6.9 2.6L2 7v9h9l-3.62-3.62A7.95 7.95 0 0 1 12.5 10.5c3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z",
        micro: "M8 5v14l11-7z",
        casque: "M12 3a9 9 0 0 0-9 9v7a2 2 0 0 0 2 2h3v-8H5v-1a7 7 0 0 1 14 0v1h-3v8h3a2 2 0 0 0 2-2v-7a9 9 0 0 0-9-9z",
        stop: "M6 6h12v12H6z"
    })

    property string onglet: favoris.liste.length ? "favoris" : "chercher"
    property string message: ""

    // Le son qui joue : `joue` = son adresse (vide si rien), `enDirect` = envoyé dans le micro.
    property string joue: ""
    property bool enDirect: false
    property var durees: ({}) // adresse → durée en secondes, connue après le premier play

    // ▶ (versMicro) : dans le micro et le casque ; 🎧 : casque seulement.
    function jouer(source, versMicro) {
        if (joue === source && enDirect === versMicro) {
            arreter()
            return
        }
        if (!micro.envoyerAuMicro(versMicro)) {
            message = "Impossible d'envoyer dans le micro : " + micro.erreur
            return
        }
        lecteur.stop()
        lecteur.source = source
        joue = source
        enDirect = versMicro
        lecteur.play()
    }

    function arreter() {
        lecteur.stop()
        joue = ""
    }

    function ouvrir(nom) {
        onglet = nom
        message = ""
        if (nom === "chercher" && !recherche.lancee) {
            recherche.lancee = true
            recherche.afficherPage(1)
        }
    }

    Connections {
        target: favoris
        function onErreur(texte) { fenetre.message = texte }
    }

    // Tout le son de l'app part dans la sortie du micro virtuel (« Sons Soundboard ») :
    // elle le renvoie vers le casque, et vers le micro quand on clique ▶.
    MediaDevices { id: peripheriques }

    MediaPlayer {
        id: lecteur
        audioOutput: AudioOutput {
            device: {
                for (const sortie of peripheriques.audioOutputs)
                    if (sortie.description === "Sons Soundboard")
                        return sortie
                return peripheriques.defaultAudioOutput
            }
        }
        onMediaStatusChanged: if (mediaStatus === MediaPlayer.EndOfMedia) fenetre.joue = ""
        // La durée est retenue pour l'afficher aussi quand le son ne joue plus.
        onDurationChanged: if (duration > 0 && fenetre.joue !== "") {
            const copie = Object.assign({}, fenetre.durees)
            copie[fenetre.joue] = duration / 1000
            fenetre.durees = copie
        }
        onErrorOccurred: (erreur, texte) => {
            fenetre.message = "Impossible de lire ce son : " + texte
            fenetre.joue = ""
        }
    }

    header: Rectangle {
        implicitHeight: entete.implicitHeight + 24
        color: fenetre.color

        ColumnLayout {
            id: entete
            anchors.fill: parent
            anchors.margins: 12
            spacing: 12

            RowLayout {
                spacing: 8
                Onglet { texte: "⭐ Favoris"; nom: "favoris" }
                Onglet { texte: "🔍 Chercher"; nom: "chercher" }
            }

            TextField {
                id: champ
                Layout.fillWidth: true
                visible: fenetre.onglet === "chercher"
                placeholderText: "Chercher un son sur myinstants…"
                placeholderTextColor: "#9a94b0"
                color: "#ece9f5"
                font.pixelSize: 16
                background: Rectangle {
                    radius: 10
                    color: "#1a1726"
                    border.color: champ.activeFocus ? "#a855f7" : "#2e2a42"
                }
                onAccepted: {
                    recherche.mot = text.trim()
                    recherche.afficherPage(1)
                }
            }
        }

        Rectangle { anchors.bottom: parent.bottom; width: parent.width; height: 1; color: "#2e2a42" }
    }

    ColumnLayout {
        anchors.fill: parent
        spacing: 0

        Text {
            Layout.fillWidth: true
            Layout.margins: 8
            visible: fenetre.message !== ""
            text: fenetre.message
            color: "#9a94b0"
            font.pixelSize: 15
            horizontalAlignment: Text.AlignHCenter
            wrapMode: Text.Wrap
        }

        Text {
            Layout.fillWidth: true
            Layout.topMargin: 48
            visible: fenetre.onglet === "favoris" && favoris.liste.length === 0
            text: "Aucun favori pour l'instant. Va dans 🔍 Chercher et clique sur ＋ sur un son."
            color: "#9a94b0"
            font.pixelSize: 15
            horizontalAlignment: Text.AlignHCenter
            wrapMode: Text.Wrap
        }

        // ---------- Favoris ----------
        Grille {
            visible: fenetre.onglet === "favoris"
            model: favoris.liste
            delegate: BoxSon {
                required property var modelData
                titre: modelData.titre
                source: modelData.source
                coin: "retirer"
                onRetirer: {
                    if (fenetre.joue === source)
                        fenetre.arreter()
                    favoris.retirer(modelData.fichier)
                }
            }
        }

        // ---------- Recherche : une seule page affichée à la fois ----------
        Item {
            id: recherche

            property bool lancee: false
            property string mot: ""
            property int page: 1
            property bool chargement: false

            function afficherPage(n) {
                page = n
                sons.clear()
                chargement = true
                fenetre.message = "Chargement…"
                myinstants.chercher(mot, n)
            }

            Layout.fillWidth: true
            Layout.fillHeight: true
            visible: fenetre.onglet === "chercher"

            ListModel { id: sons }

            Connections {
                target: myinstants
                function onResultats(liste) {
                    sons.clear()
                    for (const son of liste)
                        sons.append(son)
                    recherche.chargement = false
                    fenetre.message = liste.length ? "" : (recherche.page === 1 ? "Aucun son trouvé." : "Plus aucun son.")
                    grilleRecherche.positionViewAtBeginning()
                }
                function onErreur(texte) {
                    recherche.chargement = false
                    fenetre.message = "Erreur : " + texte
                }
            }

            ColumnLayout {
                anchors.fill: parent
                spacing: 0

                Grille {
                    id: grilleRecherche
                    model: sons
                    delegate: BoxSon {
                        required property var model
                        required property string url
                        titre: model.titre
                        source: url
                        coin: "ajout"
                        // Dépend de la liste : se met à jour dès qu'un favori est ajouté ou retiré.
                        deja: favoris.liste && favoris.contient(url)
                        onAjouter: favoris.ajouter(titre, url)
                    }
                }

                RowLayout {
                    Layout.alignment: Qt.AlignHCenter
                    Layout.margins: 10
                    spacing: 16
                    Button { text: "◀ Précédente"; enabled: recherche.page > 1 && !recherche.chargement; onClicked: recherche.afficherPage(recherche.page - 1) }
                    Text { text: "Page " + recherche.page; color: "#ece9f5"; font.pixelSize: 15 }
                    Button { text: "Suivante ▶"; enabled: sons.count > 0 && !recherche.chargement; onClicked: recherche.afficherPage(recherche.page + 1) }
                }
            }
        }
    }

    // GridView ne crée que les box visibles : le défilement reste fluide.
    component Grille: GridView {
        id: grille
        readonly property int colonnes: Math.max(1, Math.floor(width / 200))
        Layout.fillWidth: true
        Layout.fillHeight: true
        Layout.margins: 9
        clip: true
        cellWidth: width / colonnes
        cellHeight: 170
        boundsBehavior: Flickable.StopAtBounds
        ScrollBar.vertical: ScrollBar {}
    }

    // Une box, au design des pads : en haut écoulé / barre / restant, le titre avec ＋ ou ✕,
    // en bas ↶ revenir au début, ▶ dans le micro (et le casque), 🎧 casque seulement.
    component BoxSon: Item {
        id: boite

        required property int index
        property string titre
        property string source
        property string coin        // "ajout" (recherche) ou "retirer" (favoris)
        property bool deja: false   // déjà en favori (recherche)
        property bool confirmer: false
        signal ajouter()
        signal retirer()

        readonly property color c: fenetre.couleurs[index % fenetre.couleurs.length]
        readonly property bool active: fenetre.joue === source
        readonly property real duree: fenetre.durees[source] || 0
        readonly property real ecoule: active ? lecteur.position / 1000 : 0

        width: GridView.view.cellWidth
        height: GridView.view.cellHeight

        Rectangle {
            anchors.fill: parent
            anchors.margins: 7
            radius: 10
            color: "#17131f"
            border.width: boite.active ? 3 : 2
            border.color: boite.active ? (fenetre.enDirect ? "#ef4444" : "white") : boite.c
            clip: true

            ColumnLayout {
                anchors.fill: parent
                anchors.margins: 2
                spacing: 0

                Rectangle {
                    Layout.fillWidth: true
                    Layout.preferredHeight: 30
                    color: Qt.darker(boite.c, 1.8)
                    topLeftRadius: 8
                    topRightRadius: 8

                    RowLayout {
                        anchors.fill: parent
                        anchors.leftMargin: 8
                        anchors.rightMargin: 8
                        spacing: 10

                        Text { text: boite.ecoule.toFixed(1); color: "white"; font.pixelSize: 14 }

                        Item {
                            id: barre
                            readonly property real avance: boite.duree > 0 ? Math.min(boite.ecoule / boite.duree, 1) : 0
                            Layout.fillWidth: true
                            Layout.preferredHeight: 16
                            opacity: boite.active ? 1 : 0.6

                            Rectangle { anchors.verticalCenter: parent.verticalCenter; width: parent.width; height: 6; radius: 3; color: "#40ffffff" }
                            Rectangle { anchors.verticalCenter: parent.verticalCenter; width: parent.width * barre.avance; height: 6; radius: 3; color: "white" }
                            Rectangle {
                                anchors.verticalCenter: parent.verticalCenter
                                x: parent.width * barre.avance - width / 2
                                width: 14; height: 14; radius: 7; color: "white"
                            }
                            // Clic ou glissement : saute à ce moment du son (seulement celui qui joue).
                            MouseArea {
                                anchors.fill: parent
                                enabled: boite.active
                                cursorShape: Qt.PointingHandCursor
                                function sauter(x) { if (lecteur.duration > 0) lecteur.position = Math.max(0, Math.min(1, x / width)) * lecteur.duration }
                                onPressed: (souris) => sauter(souris.x)
                                onPositionChanged: (souris) => sauter(souris.x)
                            }
                        }

                        Text {
                            text: boite.duree > 0 ? "-" + Math.max(boite.duree - boite.ecoule, 0).toFixed(1) : "--.-"
                            color: "white"
                            font.pixelSize: 14
                        }
                    }
                }

                Rectangle { Layout.fillWidth: true; Layout.preferredHeight: 3; color: boite.c }

                RowLayout {
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    Layout.margins: 10
                    spacing: 8

                    ColumnLayout {
                        Layout.fillWidth: true
                        Layout.alignment: Qt.AlignTop
                        spacing: 4
                        Label {
                            visible: boite.active && fenetre.enDirect
                            text: "EN DIRECT"
                            color: "white"
                            font.pixelSize: 10
                            font.bold: true
                            padding: 2
                            leftPadding: 6
                            rightPadding: 6
                            background: Rectangle { color: "#ef4444"; radius: 4 }
                        }
                        Text {
                            Layout.fillWidth: true
                            text: boite.titre
                            color: "#ece9f5"
                            font.pixelSize: 16
                            wrapMode: Text.Wrap
                            maximumLineCount: 3
                            elide: Text.ElideRight
                        }
                    }

                    // ＋ (recherche) devient ✓ ; ✕ (favoris) demande deux clics : un clic de travers ne supprime rien.
                    Button {
                        Layout.alignment: Qt.AlignTop
                        implicitWidth: Math.max(30, contentItem.implicitWidth + 12)
                        implicitHeight: 28
                        enabled: boite.coin === "retirer" || !boite.deja
                        text: boite.coin === "ajout" ? (boite.deja ? "✓" : "＋") : (boite.confirmer ? "Retirer ?" : "✕")
                        Accessible.name: boite.coin === "ajout"
                            ? (boite.deja ? "Déjà dans les favoris : " : "Ajouter aux favoris : ") + boite.titre
                            : "Retirer des favoris : " + boite.titre
                        palette.buttonText: "white"
                        background: Rectangle {
                            radius: 8
                            color: boite.confirmer ? "#ef4444" : "transparent"
                            border.color: "#40ffffff"
                        }
                        onClicked: {
                            if (boite.coin === "ajout") {
                                boite.ajouter()
                            } else if (!boite.confirmer) {
                                boite.confirmer = true
                                delaiConfirmation.restart()
                            } else {
                                boite.retirer()
                            }
                        }
                        Timer { id: delaiConfirmation; interval: 3000; onTriggered: boite.confirmer = false }
                    }
                }

                Rectangle {
                    Layout.fillWidth: true
                    Layout.preferredHeight: 40
                    color: boite.c
                    bottomLeftRadius: 8
                    bottomRightRadius: 8

                    RowLayout {
                        anchors.fill: parent
                        spacing: 0
                        BoutonBas { icone: fenetre.icones.debut; nom: "Revenir au début : " + boite.titre; enabled: boite.active; onClicked: lecteur.position = 0 }
                        BoutonBas {
                            icone: boite.active && fenetre.enDirect ? fenetre.icones.stop : fenetre.icones.micro
                            nom: (boite.active && fenetre.enDirect ? "Arrêter : " : "Envoyer dans le micro : ") + boite.titre
                            onClicked: fenetre.jouer(boite.source, true)
                        }
                        BoutonBas {
                            icone: boite.active && !fenetre.enDirect ? fenetre.icones.stop : fenetre.icones.casque
                            nom: (boite.active && !fenetre.enDirect ? "Arrêter : " : "Écouter dans le casque : ") + boite.titre
                            onClicked: fenetre.jouer(boite.source, false)
                        }
                    }
                }
            }
        }
    }

    component BoutonBas: Item {
        id: bouton
        property string icone
        property string nom
        signal clicked()

        Layout.fillWidth: true
        Layout.fillHeight: true
        opacity: enabled ? 1 : 0.4
        Accessible.role: Accessible.Button
        Accessible.name: nom
        activeFocusOnTab: true
        Keys.onSpacePressed: bouton.clicked()

        Rectangle {
            anchors.fill: parent
            color: zone.containsMouse && bouton.enabled ? "#2e000000" : "transparent"
            border.width: bouton.activeFocus ? 2 : 0
            border.color: "white"
        }
        Shape {
            anchors.centerIn: parent
            width: 24
            height: 24
            scale: 26 / 24
            preferredRendererType: Shape.CurveRenderer
            ShapePath {
                fillColor: "white"
                strokeColor: "transparent"
                PathSvg { path: bouton.icone }
            }
        }
        MouseArea {
            id: zone
            anchors.fill: parent
            hoverEnabled: true
            cursorShape: Qt.PointingHandCursor
            onClicked: bouton.clicked()
        }
    }

    component Onglet: Button {
        id: bouton
        property string texte
        property string nom
        readonly property bool actif: fenetre.onglet === nom
        text: texte
        font.bold: true
        implicitHeight: 36
        leftPadding: 16
        rightPadding: 16
        palette.buttonText: actif ? "white" : "#ece9f5"
        background: Rectangle {
            radius: height / 2
            border.color: bouton.actif ? "transparent" : "#2e2a42"
            gradient: Gradient {
                orientation: Gradient.Horizontal
                GradientStop { position: 0; color: bouton.actif ? "#a855f7" : "#1a1726" }
                GradientStop { position: 1; color: bouton.actif ? "#ec4899" : "#1a1726" }
            }
        }
        onClicked: fenetre.ouvrir(nom)
    }

    Component.onCompleted: {
        showMaximized()
        // Fige l'onglet de départ : il ne change plus tout seul quand les favoris changent.
        ouvrir(onglet)
        if (!micro.pret)
            message = "Micro virtuel indisponible : " + micro.erreur
    }
}
