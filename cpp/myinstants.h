#pragma once
// Source de sons myinstants.com. Seul fichier qui connaît le site.

#include <QList>
#include <QNetworkAccessManager>
#include <QNetworkReply>
#include <QObject>
#include <QPointer>
#include <QString>
#include <QVariantList>

struct Son {
    QString titre;
    QString url;
};

// Extrait les (titre, url du MP3) d'une page HTML du site.
QList<Son> lireSons(const QString &html);

class Myinstants : public QObject {
    Q_OBJECT
public:
    // Mot vide : la liste FR ; sinon, une recherche. Répond par `resultats` ou `erreur`.
    Q_INVOKABLE void chercher(const QString &mot, int page);

signals:
    void resultats(const QVariantList &sons); // [{ titre, url }]
    void erreur(const QString &message);

private:
    QNetworkAccessManager reseau;
    QPointer<QNetworkReply> enCours; // annulée si une nouvelle page est demandée
};
