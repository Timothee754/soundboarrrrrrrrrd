#include "favoris.h"

#include <QDateTime>
#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QNetworkReply>
#include <QNetworkRequest>
#include <QRegularExpression>
#include <QSaveFile>
#include <QUrl>

// Assez pour un long son ou une musique, pas assez pour remplir le disque par erreur.
static constexpr qint64 TAILLE_MAX = 50 * 1024 * 1024;

QString extension(const QString &url)
{
    static const QRegularExpression valide("^[A-Za-z0-9]{1,4}$");
    const QString suffixe = QFileInfo(QUrl(url).path()).suffix();
    return valide.match(suffixe).hasMatch() ? suffixe : "mp3";
}

Favoris::Favoris(const QString &dossier) : dossier(dossier)
{
    QFile fichier(QDir(dossier).filePath("favoris.json"));
    if (!fichier.exists())
        return;
    QJsonParseError probleme;
    const auto document = fichier.open(QIODevice::ReadOnly) ? QJsonDocument::fromJson(fichier.readAll(), &probleme) : QJsonDocument();
    if (!document.isArray()) {
        illisible = true;
        return;
    }
    for (const auto &valeur : document.array()) {
        const auto objet = valeur.toObject();
        favoris.append({objet["titre"].toString(), objet["url"].toString(), objet["fichier"].toString()});
    }
}

QVariantList Favoris::liste() const
{
    QVariantList liste;
    for (const auto &favori : favoris)
        liste.append(QVariantMap{
            {"titre", favori.titre},
            {"url", favori.url},
            {"fichier", favori.fichier},
            {"source", QUrl::fromLocalFile(QDir(dossier).filePath(favori.fichier)).toString()},
        });
    return liste;
}

bool Favoris::contient(const QString &url) const
{
    return std::any_of(favoris.cbegin(), favoris.cend(), [&](const Favori &f) { return f.url == url; });
}

void Favoris::ajouter(const QString &titre, const QString &url)
{
    if (illisible) {
        emit erreur("favoris.json est illisible : rien n'est écrit pour ne pas l'écraser");
        return;
    }
    if (!url.startsWith("https://") && !url.startsWith("http://")) {
        emit erreur("adresse refusée : " + url);
        return;
    }
    if (contient(url) || enTelechargement.contains(url))
        return;
    enTelechargement.insert(url);

    QNetworkRequest requete{QUrl(url)};
    requete.setHeader(QNetworkRequest::UserAgentHeader, "Mozilla/5.0");
    QNetworkReply *reponse = reseau.get(requete);
    connect(reponse, &QNetworkReply::finished, this, [this, reponse, titre, url] {
        reponse->deleteLater();
        enTelechargement.remove(url);
        if (reponse->error() != QNetworkReply::NoError) {
            emit erreur(QString("impossible de télécharger « %1 » : %2").arg(titre, reponse->errorString()));
            return;
        }
        const QByteArray octets = reponse->readAll();
        if (octets.size() > TAILLE_MAX) {
            emit erreur(QString("« %1 » est trop gros (plus de 50 Mo)").arg(titre));
            return;
        }
        QDir().mkpath(dossier);
        const QString nom = QString("%1.%2").arg(QDateTime::currentMSecsSinceEpoch()).arg(extension(url));
        QSaveFile fichier(QDir(dossier).filePath(nom));
        if (!fichier.open(QIODevice::WriteOnly) || fichier.write(octets) != octets.size() || !fichier.commit()) {
            emit erreur(QString("impossible d'enregistrer « %1 »").arg(titre));
            return;
        }
        favoris.append({titre, url, nom});
        if (ecrire())
            emit listeChangee();
    });
}

bool Favoris::retirer(const QString &fichier)
{
    const auto position = std::find_if(favoris.begin(), favoris.end(), [&](const Favori &f) { return f.fichier == fichier; });
    if (position == favoris.end())
        return false;
    favoris.erase(position);
    if (!ecrire())
        return false;
    QFile::remove(QDir(dossier).filePath(fichier));
    emit listeChangee();
    return true;
}

// QSaveFile écrit dans un fichier temporaire puis le renomme : une coupure ne laisse jamais une liste à moitié écrite.
bool Favoris::ecrire()
{
    QJsonArray tableau;
    for (const auto &favori : favoris)
        tableau.append(QJsonObject{{"titre", favori.titre}, {"url", favori.url}, {"fichier", favori.fichier}});
    QDir().mkpath(dossier);
    QSaveFile fichier(QDir(dossier).filePath("favoris.json"));
    if (fichier.open(QIODevice::WriteOnly) && fichier.write(QJsonDocument(tableau).toJson()) >= 0 && fichier.commit())
        return true;
    emit erreur("impossible d'enregistrer favoris.json");
    return false;
}
