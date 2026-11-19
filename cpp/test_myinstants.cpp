// Vérifie le lecteur de pages myinstants sur une vraie page enregistrée.
#include "myinstants.h"

#include <QFile>
#include <cstdio>

#define VERIFIER(condition)                                              \
    if (!(condition)) {                                                  \
        std::fprintf(stderr, "échec ligne %d : %s\n", __LINE__, #condition); \
        return 1;                                                        \
    }

int main()
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

    std::puts("ok");
    return 0;
}
