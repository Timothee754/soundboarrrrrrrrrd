#include "micro_virtuel.h"

#include <QProcess>
#include <QRegularExpression>
#include <QThread>

QStringList modulesANettoyer(const QString &liste)
{
    QStringList numeros;
    for (const auto &ligne : liste.split('\n'))
        if (ligne.contains("soundboard_"))
            numeros << ligne.section('\t', 0, 0);
    return numeros;
}

QString vraiMicroDesRestes(const QString &liste)
{
    static const QRegularExpression espaces("\\s+");
    for (const auto &ligne : liste.split('\n')) {
        if (!ligne.contains("module-loopback") || !ligne.contains("sink=soundboard_mix"))
            continue;
        for (const auto &argument : ligne.split(espaces))
            if (argument.startsWith("source=") && !argument.mid(7).startsWith("soundboard_"))
                return argument.mid(7);
    }
    return {};
}

bool MicroVirtuel::echec(const QString &message)
{
    erreur_ = message;
    pret_ = false;
    emit changement();
    return false;
}

#ifdef Q_OS_LINUX

// Lance `pactl` (messages en anglais pour pouvoir les lire) ; renvoie faux et remplit `erreur` en cas d'échec.
static bool pactl(const QStringList &arguments, QString *sortie = nullptr, QString *erreur = nullptr)
{
    QProcess processus;
    auto environnement = QProcessEnvironment::systemEnvironment();
    environnement.insert("LC_ALL", "C");
    processus.setProcessEnvironment(environnement);
    processus.start("pactl", arguments);
    if (!processus.waitForFinished(5000) || processus.exitStatus() != QProcess::NormalExit || processus.exitCode() != 0) {
        if (erreur) {
            const QString detail = QString::fromUtf8(processus.readAllStandardError()).trimmed();
            *erreur = QString("pactl %1 : %2").arg(arguments.join(' '), detail.isEmpty() ? processus.errorString() : detail);
        }
        return false;
    }
    if (sortie)
        *sortie = QString::fromUtf8(processus.readAllStandardOutput()).trimmed();
    return true;
}

bool MicroVirtuel::demarrer()
{
    // Après un plantage, le micro par défaut est encore le nôtre : on remet le vrai micro
    // d'avant, sinon PipeWire en choisirait un autre (par exemple la prise jack).
    QString liste;
    if (pactl({"list", "short", "modules"}, &liste)) {
        for (const auto &numero : modulesANettoyer(liste))
            pactl({"unload-module", numero});
        const QString vraiMicro = vraiMicroDesRestes(liste);
        if (!vraiMicro.isEmpty())
            pactl({"set-default-source", vraiMicro});
    }

    QString erreur;
    if (!pactl({"get-default-source"}, &ancienMicro, &erreur))
        return echec(erreur);

    const QList<QStringList> aCharger = {
        {"module-null-sink", "sink_name=soundboard_sons", R"(sink_properties='device.description="Sons Soundboard"')"},
        {"module-null-sink", "sink_name=soundboard_mix", R"(sink_properties='device.description="Mix Soundboard"')"},
        {"module-loopback", "source=" + ancienMicro, "sink=soundboard_mix", "latency_msec=20"},
        // Retour des sons dans le casque (sortie par défaut).
        {"module-loopback", "source=soundboard_sons.monitor", "latency_msec=20"},
        {"module-remap-source", "master=soundboard_mix.monitor", "source_name=soundboard_micro",
         R"(source_properties='device.description="Micro Soundboard"')"},
    };
    for (const auto &arguments : aCharger) {
        QString numero;
        if (!pactl(QStringList{"load-module"} + arguments, &numero, &erreur)) {
            arreter();
            return echec(erreur);
        }
        modules << numero;
    }

    // Juste après sa création, PipeWire ignore le micro virtuel quelques instants : on réessaie.
    for (int essai = 0; essai < 30; ++essai) {
        pactl({"set-default-source", "soundboard_micro"});
        QThread::msleep(100);
        QString defaut;
        if (pactl({"get-default-source"}, &defaut) && defaut == "soundboard_micro") {
            pret_ = true;
            emit changement();
            return true;
        }
    }
    arreter();
    return echec("impossible de mettre « Micro Soundboard » par défaut");
}

bool MicroVirtuel::envoyerAuMicro(bool actif)
{
    if (!pret_)
        return !actif; // sans micro virtuel, l'écoute seule marche quand même
    QString erreur;
    if (actif && versMicro.isEmpty()) {
        if (!pactl({"load-module", "module-loopback", "source=soundboard_sons.monitor", "sink=soundboard_mix", "latency_msec=20"},
                   &versMicro, &erreur)) {
            erreur_ = erreur;
            emit changement();
            return false;
        }
    } else if (!actif && !versMicro.isEmpty()) {
        pactl({"unload-module", versMicro});
        versMicro.clear();
    }
    return true;
}

void MicroVirtuel::arreter()
{
    if (!versMicro.isEmpty())
        pactl({"unload-module", versMicro});
    versMicro.clear();
    if (!ancienMicro.isEmpty() && ancienMicro != "soundboard_micro")
        pactl({"set-default-source", ancienMicro});
    for (auto numero = modules.crbegin(); numero != modules.crend(); ++numero)
        pactl({"unload-module", *numero});
    modules.clear();
    pret_ = false;
}

#else

// shortcut: Windows et macOS (VB-Cable, BlackHole) pas encore faits, à coder avec une machine de test.
bool MicroVirtuel::demarrer() { return echec("pas encore disponible sur ce système"); }
bool MicroVirtuel::envoyerAuMicro(bool actif) { return !actif; }
void MicroVirtuel::arreter() {}

#endif
