#include "favoris.h"
#include "micro_virtuel.h"
#include "myinstants.h"

#include <QDir>
#include <QGuiApplication>
#include <QIcon>
#include <QLocalServer>
#include <QLocalSocket>
#include <QQmlApplicationEngine>
#include <QQmlContext>
#include <QQuickStyle>
#include <QStandardPaths>
#include <QWindow>

#ifdef Q_OS_UNIX
#include <QSocketNotifier>
#include <csignal>
#include <sys/socket.h>
#include <unistd.h>

// Déconnexion, extinction ou Ctrl+C : on quitte normalement, pour remettre le vrai micro.
// Le gestionnaire de signal ne fait qu'écrire un octet ; Qt le lit ensuite dans sa boucle.
static int tubeSignal[2];
static void surSignal(int) { [[maybe_unused]] auto ecrit = ::write(tubeSignal[1], "x", 1); }

static void quitterSurSignal(QGuiApplication &app)
{
    if (::socketpair(AF_UNIX, SOCK_STREAM, 0, tubeSignal) != 0)
        return;
    auto *notification = new QSocketNotifier(tubeSignal[0], QSocketNotifier::Read, &app);
    QObject::connect(notification, &QSocketNotifier::activated, &app, [] {
        char octet;
        [[maybe_unused]] auto lu = ::read(tubeSignal[0], &octet, 1);
        QCoreApplication::quit();
    });
    std::signal(SIGTERM, surSignal);
    std::signal(SIGINT, surSignal);
}
#else
static void quitterSurSignal(QGuiApplication &) {}
#endif

int main(int argc, char *argv[])
{
    QGuiApplication app(argc, argv);
    app.setApplicationName("Soundboarrrrrrrrrd");
    // Même nom que le .desktop installé : sous Wayland, c'est lui qui donne le logo de la fenêtre.
    app.setDesktopFileName("Soundboarrrrrrrrrd");
    app.setWindowIcon(QIcon(":/icone.png"));

    // Une seule instance : un 2e lancement ramène la fenêtre au lieu de casser le micro virtuel.
    const QString nomInstance = "soundboarrrrrrrrrd-instance";
    {
        QLocalSocket autre;
        autre.connectToServer(nomInstance);
        if (autre.waitForConnected(300))
            return 0;
    }
    QLocalServer::removeServer(nomInstance);
    QLocalServer instance;
    instance.listen(nomInstance);
    QObject::connect(&instance, &QLocalServer::newConnection, &app, [&] {
        delete instance.nextPendingConnection();
        for (QWindow *fenetre : app.topLevelWindows()) {
            fenetre->showMaximized();
            fenetre->requestActivate();
        }
    });

    MicroVirtuel micro;
    micro.demarrer();
    quitterSurSignal(app);

    // Même dossier que l'ancienne app Tauri : les favoris déjà téléchargés sont repris.
    Favoris favoris(QDir(QStandardPaths::writableLocation(QStandardPaths::GenericDataLocation))
                        .filePath("com.timothee754.soundboarrrrrrrrrd/sons"));
    Myinstants myinstants;

    // Style neutre : sinon le thème du bureau (Breeze sous KDE) change le look des contrôles.
    QQuickStyle::setStyle("Basic");
    QQmlApplicationEngine moteur;
    moteur.rootContext()->setContextProperty("micro", &micro);
    moteur.rootContext()->setContextProperty("favoris", &favoris);
    moteur.rootContext()->setContextProperty("myinstants", &myinstants);
    QObject::connect(&moteur, &QQmlApplicationEngine::objectCreationFailed, &app, [] { QCoreApplication::exit(1); },
                     Qt::QueuedConnection);
    moteur.loadFromModule("Soundboard", "Main");

    const int code = app.exec();
    micro.arreter();
    return code;
}
