// Tests du cœur : lecteur de pages myinstants, nettoyage du micro virtuel, favoris.
#include "favoris.h"
#include "micro_virtuel.h"
#include "myinstants.h"

#include <QCoreApplication>
#include <QDir>
#include <QFile>
#include <QTemporaryDir>
#include <cstdio>

#define VERIFIER(condition)                                              \
    if (!(condition)) {                                                  \
        std::fprintf(stderr, "échec ligne %d : %s\n", __LINE__, #condition); \
        return 1;                                                        \
    }

static int testerMyinstants()
{
    QFile page(PAGE_FR);
    VERIFIER(page.open(QIODevice::ReadOnly));
    const auto sons = lireSons(QString::fromUtf8(page.readAll()));
    VERIFIER(sons.size() == 36);
    for (const auto &son : sons) {
        VERIFIER(!son.titre.isEmpty() && !son.titre.contains("&#x27;"));
        VERIFIER(son.url.startsWith("https://www.myinstants.com/media/sounds/") && son.url.endsWith(".mp3"));
    }

    const auto un = lireSons(R"x(<button class="small-button" onclick="play('/media/sounds/cest-vrai_tNRnaW4.mp3', 'loader-649284', 'cest-vrai-54735')" title="Play C&#x27;est vrai ? sound" type="button">)x");
    VERIFIER(un.size() == 1);
    VERIFIER(un[0].titre == "C'est vrai ?");
    VERIFIER(un[0].url == "https://www.myinstants.com/media/sounds/cest-vrai_tNRnaW4.mp3");
    return 0;
}

static int testerMicroVirtuel()
{
    const QString liste =
        "1\tmodule-null-sink\tsink_name=soundboard_mix\n"
        "2\tmodule-loopback\tsource=soundboard_sons.monitor sink=soundboard_mix latency_msec=20\n"
        "3\tmodule-loopback\tsource=alsa_input.usb-HyperX sink=soundboard_mix latency_msec=20\n"
        "4\tmodule-loopback\tsource=alsa_input.usb latency_msec=20\n"
        "12\tmodule-x11-bell\t";
    VERIFIER(modulesANettoyer(liste) == QStringList({"1", "2", "3"}));
    VERIFIER(vraiMicroDesRestes(liste) == "alsa_input.usb-HyperX");
    VERIFIER(vraiMicroDesRestes("12\tmodule-x11-bell\t").isEmpty());
    return 0;
}

static int testerFavoris()
{
    VERIFIER(extension("https://www.myinstants.com/media/sounds/bruh.mp3") == "mp3");
    VERIFIER(extension("https://a.b/son.ogg?x=1") == "ogg");
    VERIFIER(extension("https://a.b/sans-extension") == "mp3");

    QTemporaryDir dossier;
    VERIFIER(dossier.isValid());
    VERIFIER(Favoris(dossier.path()).liste().isEmpty());

    QFile son(dossier.filePath("1.mp3"));
    VERIFIER(son.open(QIODevice::WriteOnly) && son.write("son") == 3);
    son.close();
    QFile index(dossier.filePath("favoris.json"));
    VERIFIER(index.open(QIODevice::WriteOnly));
    index.write(R"([{ "titre": "Bruh", "url": "https://a.b/bruh.mp3", "fichier": "1.mp3" }])");
    index.close();

    Favoris favoris(dossier.path());
    VERIFIER(favoris.liste().size() == 1);
    VERIFIER(favoris.contient("https://a.b/bruh.mp3"));
    VERIFIER(!favoris.retirer("../../etc/passwd"));
    VERIFIER(favoris.retirer("1.mp3"));
    VERIFIER(favoris.liste().isEmpty() && !QFile::exists(dossier.filePath("1.mp3")));
    VERIFIER(Favoris(dossier.path()).liste().isEmpty()); // la suppression est bien écrite sur le disque

    // Un favoris.json abîmé n'est jamais écrasé.
    VERIFIER(index.open(QIODevice::WriteOnly) && index.write("pas du json") > 0);
    index.close();
    Favoris abime(dossier.path());
    abime.ajouter("X", "https://a.b/x.mp3");
    VERIFIER(index.open(QIODevice::ReadOnly) && index.readAll() == "pas du json");
    return 0;
}

int main(int argc, char *argv[])
{
    QCoreApplication app(argc, argv); // pour QNetworkAccessManager
    if (testerMyinstants() || testerMicroVirtuel() || testerFavoris())
        return 1;
    std::puts("ok");
    return 0;
}
