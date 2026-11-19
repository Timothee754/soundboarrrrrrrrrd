import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import QtMultimedia
import QtQuick.Shapes

// Essai C++/Qt : recherche myinstants paginée, en box, avec lecture 🎧 (casque).
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

    property string mot: ""
    property int page: 1
    property bool chargement: false
    property string message: ""
    property int joue: -1           // index de la box qui joue, -1 si rien
    property var durees: ({})       // url → durée en secondes, connue après le premier play

    ListModel { id: sons }

    function afficherPage(n) {
        page = n
        arreter()
        sons.clear()
        chargement = true
        message = "Chargement…"
        myinstants.chercher(mot, n)
    }

    function jouer(index, url) {
        if (joue === index) {
            arreter()
            return
        }
        lecteur.stop()
        lecteur.source = url
        joue = index
        lecteur.play()
    }

    function arreter() {
        lecteur.stop()
        joue = -1
    }

    Connections {
        target: myinstants
        function onResultats(liste) {
            sons.clear()
            for (const son of liste)
                sons.append(son)
            chargement = false
            message = liste.length ? "" : (page === 1 ? "Aucun son trouvé." : "Plus aucun son.")
            grille.positionViewAtBeginning()
        }
        function onErreur(texte) {
            chargement = false
            message = "Erreur : " + texte
        }
    }

    MediaPlayer {
        id: lecteur
        audioOutput: AudioOutput {}
        onMediaStatusChanged: if (mediaStatus === MediaPlayer.EndOfMedia) fenetre.joue = -1
        // La durée est retenue pour l'afficher aussi quand le son ne joue plus.
        onDurationChanged: if (duration > 0 && fenetre.joue >= 0) {
            const copie = Object.assign({}, fenetre.durees)
            copie[source.toString()] = duration / 1000
            fenetre.durees = copie
        }
        onErrorOccurred: (erreur, texte) => {
            fenetre.message = "Impossible de lire ce son : " + texte
            fenetre.joue = -1
        }
    }

    header: Rectangle {
        height: 64
        color: fenetre.color

        TextField {
            id: champ
            anchors.fill: parent
            anchors.margins: 12
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
                fenetre.mot = text.trim()
                fenetre.afficherPage(1)
            }
        }

        Rectangle { anchors.bottom: parent.bottom; width: parent.width; height: 1; color: "#2e2a42" }
    }

    // GridView ne crée que les box visibles : le défilement reste fluide.
    GridView {
        id: grille

        readonly property int colonnes: Math.max(1, Math.floor(width / 200))

        anchors.fill: parent
        anchors.margins: 9
        clip: true
        cellWidth: width / colonnes
        cellHeight: 170
        model: sons
        boundsBehavior: Flickable.StopAtBounds
        ScrollBar.vertical: ScrollBar {}

        delegate: Item {
            id: boite

            required property int index
            required property string titre
            required property string url

            readonly property color c: fenetre.couleurs[index % fenetre.couleurs.length]
            readonly property bool active: fenetre.joue === index
            readonly property real duree: fenetre.durees[url] || 0
            readonly property real ecoule: active ? lecteur.position / 1000 : 0

            width: grille.cellWidth
            height: grille.cellHeight

            Rectangle {
                anchors.fill: parent
                anchors.margins: 7
                radius: 10
                color: "#17131f"
                border.width: 2
                border.color: boite.active ? "white" : boite.c
                clip: true

                ColumnLayout {
                    anchors.fill: parent
                    anchors.margins: 2
                    spacing: 0

                    // En haut : temps écoulé, barre de progression, temps restant.
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
                                Layout.fillWidth: true
                                Layout.preferredHeight: 16
                                opacity: boite.active ? 1 : 0.6

                                readonly property real avance: boite.duree > 0 ? Math.min(boite.ecoule / boite.duree, 1) : 0

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

                    Text {
                        Layout.fillWidth: true
                        Layout.fillHeight: true
                        padding: 10
                        text: boite.titre
                        color: "#ece9f5"
                        font.pixelSize: 16
                        wrapMode: Text.Wrap
                        maximumLineCount: 3
                        elide: Text.ElideRight
                    }

                    // En bas : ↶ revenir au début, ▶ micro (pas encore dans l'essai), 🎧 casque.
                    Rectangle {
                        Layout.fillWidth: true
                        Layout.preferredHeight: 40
                        color: boite.c
                        bottomLeftRadius: 8
                        bottomRightRadius: 8

                        RowLayout {
                            anchors.fill: parent
                            spacing: 0
                            BoutonBas { icone: fenetre.icones.debut; nom: "Revenir au début"; enabled: boite.active; onClicked: lecteur.position = 0 }
                            BoutonBas { icone: fenetre.icones.micro; nom: "Envoyer dans le micro (pas encore dans l'essai C++)"; enabled: false }
                            BoutonBas {
                                icone: boite.active ? fenetre.icones.stop : fenetre.icones.casque
                                nom: (boite.active ? "Arrêter : " : "Écouter dans le casque : ") + boite.titre
                                onClicked: fenetre.jouer(boite.index, boite.url)
                            }
                        }
                    }
                }
            }
        }
    }

    Text {
        anchors.centerIn: parent
        visible: fenetre.message !== ""
        text: fenetre.message
        color: "#9a94b0"
        font.pixelSize: 15
    }

    footer: Rectangle {
        height: 56
        color: fenetre.color

        RowLayout {
            anchors.centerIn: parent
            spacing: 16
            Button { text: "◀ Précédente"; enabled: fenetre.page > 1 && !fenetre.chargement; onClicked: fenetre.afficherPage(fenetre.page - 1) }
            Text { text: "Page " + fenetre.page; color: "#ece9f5"; font.pixelSize: 15 }
            Button { text: "Suivante ▶"; enabled: sons.count > 0 && !fenetre.chargement; onClicked: fenetre.afficherPage(fenetre.page + 1) }
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

        Rectangle { anchors.fill: parent; color: zone.containsMouse && bouton.enabled ? "#2e000000" : "transparent" }
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

    Component.onCompleted: {
        showMaximized()
        afficherPage(1)
    }
}
