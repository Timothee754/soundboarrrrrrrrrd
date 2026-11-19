#include "myinstants.h"

#include <QGuiApplication>
#include <QQmlApplicationEngine>
#include <QQmlContext>
#include <QQuickStyle>

int main(int argc, char *argv[])
{
    QGuiApplication app(argc, argv);
    app.setApplicationName("Soundboarrrrrrrrrd");
    // Style neutre : sinon le thème du bureau (Breeze sous KDE) change le look des contrôles.
    QQuickStyle::setStyle("Basic");

    Myinstants myinstants;
    QQmlApplicationEngine moteur;
    moteur.rootContext()->setContextProperty("myinstants", &myinstants);
    QObject::connect(&moteur, &QQmlApplicationEngine::objectCreationFailed, &app, [] { QCoreApplication::exit(1); },
                     Qt::QueuedConnection);
    moteur.loadFromModule("Soundboard", "Main");
    return app.exec();
}
