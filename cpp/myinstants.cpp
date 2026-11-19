#include "myinstants.h"

#include <QNetworkRequest>
#include <QRegularExpression>
#include <QUrl>
#include <QUrlQuery>

static const QString SITE = QStringLiteral("https://www.myinstants.com");

// Le site (Django) n'échappe que ces 5 caractères ; `&amp;` en dernier.
static QString decoderHtml(QString s)
{
    return s.replace("&#x27;", "'").replace("&quot;", "\"").replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&");
}

QList<Son> lireSons(const QString &html)
{
    // <button ... onclick="play('/media/sounds/x.mp3', ...)" title="Play <titre> sound">
    static const QRegularExpression bouton(
        QStringLiteral(R"re(onclick="play\('(/media/sounds/[^']+)'[^"]*"\s+title="Play (.*?) sound")re"));
    QList<Son> sons;
    for (auto it = bouton.globalMatch(html); it.hasNext();) {
        const auto m = it.next();
        sons.append({decoderHtml(m.captured(2)), SITE + m.captured(1)});
    }
    return sons;
}

void Myinstants::chercher(const QString &mot, int page)
{
    if (enCours)
        enCours->abort();

    QUrl url(SITE + (mot.isEmpty() ? "/en/index/fr/" : "/en/search/"));
    QUrlQuery parametres;
    if (!mot.isEmpty())
        parametres.addQueryItem("name", mot);
    parametres.addQueryItem("page", QString::number(page));
    url.setQuery(parametres);

    QNetworkRequest requete(url);
    requete.setHeader(QNetworkRequest::UserAgentHeader, "Mozilla/5.0"); // seul User-Agent testé sur le site
    QNetworkReply *reponse = reseau.get(requete);
    enCours = reponse;

    connect(reponse, &QNetworkReply::finished, this, [this, reponse] {
        reponse->deleteLater();
        if (reponse->error() == QNetworkReply::OperationCanceledError)
            return;
        // Le site répond 404 après la dernière page et quand une recherche ne trouve rien.
        if (reponse->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt() == 404) {
            emit resultats({});
            return;
        }
        if (reponse->error() != QNetworkReply::NoError) {
            emit erreur(reponse->errorString());
            return;
        }
        QVariantList sons;
        for (const auto &son : lireSons(QString::fromUtf8(reponse->readAll())))
            sons.append(QVariantMap{{"titre", son.titre}, {"url", son.url}});
        emit resultats(sons);
    });
}
