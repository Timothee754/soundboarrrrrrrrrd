#pragma once
// Micro virtuel : seul module propre à chaque système.
//
// Linux (PipeWire ou PulseAudio, via `pactl`) :
//   son de l'app ─► « soundboard_sons » ─┬─► casque (toujours)
//                                        └─► « soundboard_mix » (seulement si envoyerAuMicro(true))
//   vrai micro ─────────────────────────────► « soundboard_mix »
//   « soundboard_mix » ─► « Micro Soundboard » (soundboard_micro), défini comme micro par défaut
// Tous les modules contiennent `soundboard_` dans leurs arguments, pour le nettoyage.

#include <QObject>
#include <QString>
#include <QStringList>

// Numéros des modules créés par l'app, d'après `pactl list short modules`.
QStringList modulesANettoyer(const QString &liste);
// Le vrai micro branché sur le mélange, lu dans les restes d'une session plantée.
QString vraiMicroDesRestes(const QString &liste);

class MicroVirtuel : public QObject {
    Q_OBJECT
    Q_PROPERTY(bool pret READ pret NOTIFY changement)
    Q_PROPERTY(QString erreur READ erreur NOTIFY changement)
public:
    // Crée le micro virtuel et le met par défaut ; nettoie d'abord les restes d'un plantage.
    bool demarrer();
    // Branche ou débranche les sons de l'app sur le micro virtuel.
    Q_INVOKABLE bool envoyerAuMicro(bool actif);
    // Remet l'ancien micro par défaut et supprime tout ce que l'app a créé.
    void arreter();

    bool pret() const { return pret_; }
    QString erreur() const { return erreur_; }

signals:
    void changement();

private:
    bool echec(const QString &message);

    bool pret_ = false;
    QString erreur_;
    QString ancienMicro;
    QStringList modules;
    QString versMicro; // module qui envoie les sons dans le micro, vide si débranché
};
