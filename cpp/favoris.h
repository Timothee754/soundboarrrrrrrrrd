#pragma once
// Les favoris : sons téléchargés dans le dossier de l'app, utilisables sans internet.
// `favoris.json` garde l'ordre et les titres ; chaque son est un fichier à côté.

#include <QList>
#include <QNetworkAccessManager>
#include <QObject>
#include <QSet>
#include <QString>
#include <QVariantList>

struct Favori {
    QString titre;
    QString url;     // adresse d'origine, pour savoir si un résultat de recherche est déjà en favori
    QString fichier; // nom du fichier dans le dossier des sons
};

// Extension du fichier d'après l'adresse (`mp3` par défaut).
QString extension(const QString &url);

class Favoris : public QObject {
    Q_OBJECT
    // [{ titre, url, fichier, source }] ; `source` est l'adresse du fichier local, pour le lecteur.
    Q_PROPERTY(QVariantList liste READ liste NOTIFY listeChangee)
public:
    explicit Favoris(const QString &dossier);

    QVariantList liste() const;
    Q_INVOKABLE bool contient(const QString &url) const;
    Q_INVOKABLE void ajouter(const QString &titre, const QString &url);
    // Seul un fichier de la liste peut être supprimé : pas de chemin venu de l'interface.
    Q_INVOKABLE bool retirer(const QString &fichier);

signals:
    void listeChangee();
    void erreur(const QString &message);

private:
    bool ecrire();

    QString dossier;
    QList<Favori> favoris;
    bool illisible = false; // favoris.json abîmé : on ne l'écrase pas
    QSet<QString> enTelechargement;
    QNetworkAccessManager reseau;
};
