/* pc-enfants.js — « PC des enfants » sur l'iPad : la carte du tableau et le
   rapport plein écran (maquette 3B du 27.10.2026). ES5 strict, Safari 9.

   LECTURE SEULE : l'iPad montre l'état du PC, la journée, internet et les
   demandes, mais ne décide rien (accepter, refuser, verrouiller, changer de
   mode se font sur le téléphone d'un parent). Les règles Firestore le
   garantissent côté serveur ; ce fichier n'écrit jamais rien.

   Aucun nom stocké en dur : tout vient de window.FamilyHubSchemaPc
   (js/genere/schema-controle-parental.js, copie générée de schema.ts).

   Source de l'état : status/current, écrit par le PC toutes les 60 s (ce
   qu'il applique vraiment). Au-delà de 10 min sans nouvelles : hors ligne,
   et l'écran le dit.

   API : FamilyHubPc.demarrer(db, functions, foyerId, surChangement),
         FamilyHubPc.carte(maintenant) pour le tableau,
         Tiles['pc-enfants'] pour le plein écran (FamilyHubOverlay.open).
   Les fonctions pures (haut du fichier) sont testées par
   packages/design/src/displayPcEnfants.test.ts. */
(function (root) {
  'use strict';

  var S = root && root.FamilyHubSchemaPc;

  /* ===================== Fonctions pures ===================== */

  var SEUIL_HORS_LIGNE_MS = 10 * 60000;
  var JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet',
    'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  var MAX_APPLIS = 8;
  var MAX_SITES = 8;
  var MAX_BLOQUES = 6;

  function estObjet(v) {
    return v !== null && typeof v === 'object' && Object.prototype.toString.call(v) !== '[object Array]';
  }
  function texte(v) {
    return typeof v === 'string' && v.replace(/^\s+|\s+$/g, '') ? v.replace(/^\s+|\s+$/g, '') : null;
  }
  function nombre(v) {
    return typeof v === 'number' && isFinite(v) ? v : 0;
  }

  /* Date stockée → millisecondes : chaîne ISO (le PC), horodatage Firestore, Date. */
  function enMs(v) {
    if (v === null || v === undefined) return null;
    if (typeof v.toMillis === 'function') return v.toMillis();
    if (typeof v.seconds === 'number') return v.seconds * 1000;
    if (v instanceof Date) return v.getTime();
    if (typeof v === 'number') return isFinite(v) ? v : null;
    if (typeof v === 'string') {
      var t = Date.parse(v);
      return isNaN(t) ? null : t;
    }
    return null;
  }

  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }
  /* « 17:42 », comme le reste du tableau. */
  function heure(ms) {
    var d = new Date(ms);
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }
  function jourLocal(ms) {
    var d = new Date(ms);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function memeJour(a, b) {
    return jourLocal(a) === jourLocal(b);
  }
  function lendemain(ms) {
    var d = new Date(ms);
    d.setDate(d.getDate() + 1);
    return d.getTime();
  }
  function quandTexte(ms, maintenant) {
    if (memeJour(ms, maintenant)) return heure(ms);
    if (memeJour(ms, lendemain(maintenant))) return 'demain ' + heure(ms);
    return JOURS[new Date(ms).getDay()] + ' ' + heure(ms);
  }
  /* « jusqu'à 18:30 », « jusqu'à demain 07:00 », « jusqu'à nouvel ordre ». */
  function jusquaTexte(ms, maintenant) {
    if (S && ms >= S.JUSQUA_NOUVEL_ORDRE_MS) return "jusqu'à nouvel ordre";
    return "jusqu'à " + quandTexte(ms, maintenant);
  }
  /* « 45 min », « 2h05 » (même écriture que le téléphone). */
  function dureeTexte(minutes) {
    var m = Math.round(minutes);
    if (m < 60) return m + ' min';
    return Math.floor(m / 60) + 'h' + pad2(m % 60);
  }
  function dureeSecondesTexte(s) {
    return dureeTexte(Math.floor(nombre(s) / 60));
  }

  function libelleMode(mode) {
    var M = S.VALEUR.mode;
    if (mode === M.devoirs) return 'Devoirs';
    if (mode === M.devoirsInternet) return 'Devoirs + Internet';
    if (mode === M.libre) return 'Temps libre';
    if (mode === M.libreInternet) return 'Temps libre + Internet';
    return 'Mode inconnu';
  }
  function modeEcole(mode) {
    return mode === S.VALEUR.mode.devoirs || mode === S.VALEUR.mode.devoirsInternet;
  }

  /* Ce que le PC permet en vrai : les applis du mode, et le filtrage réel. */
  function cePermet(mode, reseau) {
    var applis = modeEcole(mode) ? "Les applis d'école" : 'Toutes les applis autorisées';
    var R = S.VALEUR.reseau;
    var net = reseau === R.coupe ? "pas d'internet"
      : reseau === R.ecole ? "seulement les sites de l'école" : 'tout internet, filtré';
    return applis + ', et ' + net + '.';
  }

  /* status/current (brut) → état lisible ; null si illisible. */
  function lireEtat(brut) {
    if (!estObjet(brut)) return null;
    var E = S.CHAMP_ETAT;
    var V = S.VALEUR;
    var actives = estObjet(brut[E.exceptionsActives]) ? brut[E.exceptionsActives] : {};
    function dim(nom) {
      var a = estObjet(actives[nom]) ? actives[nom] : {};
      return {
        valeur: brut[nom],
        source: brut[nom + S.SUFFIXE_ETAT.source] || null,
        jusqua: enMs(brut[nom + S.SUFFIXE_ETAT.jusqua]),
        par: texte(a[S.CHAMP_EXCEPTION_ACTIVE.par])
      };
    }
    var pc = dim(E.pc);
    var internet = dim(E.internet);
    var mode = dim(E.mode);
    if (pc.valeur !== V.pc.autorise && pc.valeur !== V.pc.verrouille) return null;
    var catalogue = {};
    var brutCat = brut[E.catalogue];
    if (estObjet(brutCat)) {
      Object.keys(brutCat).forEach(function (id) {
        var nom = estObjet(brutCat[id]) ? texte(brutCat[id][S.CHAMP_CATALOGUE.nom]) : null;
        if (nom) catalogue[id] = nom;
      });
    }
    return {
      pc: pc,
      internet: internet,
      mode: mode,
      verrouille: pc.valeur === V.pc.verrouille,
      internetCoupe: internet.valeur === V.internet.coupe,
      reseau: brut[E.reseau] || null,
      vuLe: enMs(brut[E.vuLe]),
      fermetureA: enMs(brut[E.fermetureA]),
      catalogue: catalogue,
      applisRefusees: estObjet(brut[E.applisRefusees]) ? brut[E.applisRefusees] : {}
    };
  }

  /* D'où vient une dimension : « Choisi par Papa jusqu'à 18:30 », « Selon le planning »… */
  function origine(d, maintenant) {
    var Src = S.VALEUR.source;
    var fin = d.jusqua ? ' ' + jusquaTexte(d.jusqua, maintenant) : '';
    if (d.source === Src.exception) return 'Choisi par ' + (d.par || 'un parent') + fin;
    if (d.source === Src.codeParent) return 'Code parent tapé sur le PC' + fin;
    if (d.source === Src.local) return 'Changé sur le PC' + fin;
    if (d.source === Src.planning) return 'Selon le planning' + fin;
    return 'Mode habituel';
  }

  /* « En ligne », « Hors ligne depuis 16:05 », « hier 21:10 », « le 3 novembre ». */
  function fraicheur(vuLe, maintenant) {
    if (!vuLe) return { enLigne: false, court: 'Jamais connecté', long: "Le PC ne s'est encore jamais connecté" };
    var ecart = maintenant - vuLe;
    if (ecart < SEUIL_HORS_LIGNE_MS) {
      var min = Math.max(0, Math.floor(ecart / 60000));
      return { enLigne: true, court: 'En ligne', long: min < 1 ? "vu à l'instant" : 'vu il y a ' + min + ' min' };
    }
    var d = new Date(vuLe);
    var quand = memeJour(vuLe, maintenant) ? heure(vuLe)
      : memeJour(lendemain(vuLe), maintenant) ? 'hier ' + heure(vuLe)
      : 'le ' + d.getDate() + ' ' + MOIS[d.getMonth()];
    return { enLigne: false, court: 'Hors ligne depuis ' + quand, long: 'dernières nouvelles : ' + quand };
  }

  /* La carte du tableau. `etat` : lireEtat(...) ou null. */
  function resumeCarte(etat, enAttente, maintenant) {
    var f = fraicheur(etat ? etat.vuLe : null, maintenant);
    if (!etat) {
      return { titre: 'Pas encore de nouvelles', rouge: false, detail: '', enLigne: false, ligne: f.court, demandes: enAttente };
    }
    var titre;
    var detail;
    if (etat.verrouille) {
      titre = 'PC verrouillé';
      detail = origine(etat.pc, maintenant);
      if (etat.fermetureA && etat.fermetureA > maintenant) detail += ' · fermeture à ' + heure(etat.fermetureA);
    } else {
      titre = libelleMode(etat.mode.valeur);
      detail = origine(etat.mode, maintenant);
      if (etat.internetCoupe) detail += ' · internet coupé';
    }
    return { titre: titre, rouge: etat.verrouille, detail: detail, enLigne: f.enLigne, ligne: f.court, demandes: enAttente };
  }

  function nomAppli(id, noms, etat) {
    if (noms && texte(noms[id])) return texte(noms[id]);
    if (etat && etat.catalogue[id]) return etat.catalogue[id];
    var p = S.PREFIXE_AUTRE_APPLI;
    if (id.indexOf(p) === 0) return 'Autre (' + id.slice(p.length) + ')';
    return id;
  }

  /* usage/{jour} (brut) → applis du plus long au plus court ; moins d'une minute : rien. */
  function applisDuJour(usage, etat) {
    if (!estObjet(usage)) return [];
    var U = S.CHAMP_USAGE;
    var parAppli = estObjet(usage[U.secondesParAppli]) ? usage[U.secondesParAppli] : {};
    var noms = estObjet(usage[U.nomsApplis]) ? usage[U.nomsApplis] : {};
    var liste = [];
    Object.keys(parAppli).forEach(function (id) {
      if (id.indexOf(S.PREFIXE_INTERNE) === 0) return;
      var s = nombre(parAppli[id]);
      if (s >= 60) liste.push({ id: id, nom: nomAppli(id, noms, etat), secondes: s });
    });
    liste.sort(function (a, b) { return b.secondes - a.secondes; });
    liste = liste.slice(0, MAX_APPLIS);
    var max = liste.length ? liste[0].secondes : 1;
    return liste.map(function (a) {
      return { nom: a.nom, duree: dureeSecondesTexte(a.secondes), part: Math.max(4, Math.round(a.secondes / max * 100)) };
    });
  }

  /* Ce que l'enfant demande, en mots (mêmes phrases que le téléphone). */
  function titreDemande(d, noms, etat) {
    var D = S.CHAMP_DEMANDE;
    var T = S.VALEUR.typeDemande;
    var minutes = d[D.dureeMinutes];
    var duree = typeof minutes === 'number' && minutes > 0 ? dureeTexte(minutes) : null;
    var detail = texte(d[D.detail]) || '';
    switch (d[D.type]) {
      case T.temps: return duree ? 'Plus de temps : ' + duree : 'Plus de temps';
      case T.mode: {
        var mode = libelleMode(detail);
        if (mode === 'Mode inconnu') mode = 'Un autre mode';
        return duree ? mode + ' pendant ' + duree : mode;
      }
      case T.site: return detail ? 'Le site ' + detail : 'Un site';
      case T.appli: return detail ? "L'appli " + nomAppli(detail, noms, etat) : 'Une appli';
      default: return 'Un message';
    }
  }

  /* requests (bruts, avec leur id) → demandes du jour, la plus ancienne d'abord. */
  function demandesDuJour(brutes, maintenant) {
    var D = S.CHAMP_DEMANDE;
    var aujourdhui = jourLocal(maintenant);
    return (brutes || []).filter(function (d) {
      var t = enMs(d[D.creeeLe]);
      return t !== null && jourLocal(t) === aujourdhui;
    }).sort(function (a, b) { return enMs(a[D.creeeLe]) - enMs(b[D.creeeLe]); });
  }

  function enAttente(d) {
    var st = d[S.CHAMP_DEMANDE.statut];
    return !st || st === S.VALEUR.statutDemande.enAttente;
  }

  /* Nom montré à l'enfant pour un parent (« Papa »), sinon « un parent ». */
  function nomParent(config, uid) {
    var noms = config && estObjet(config[S.CHAMP_CONFIG.nomsParents]) ? config[S.CHAMP_CONFIG.nomsParents] : {};
    return (uid && texte(noms[uid])) || 'un parent';
  }

  /* La journée, dans l'ordre : demandes et leur réponse, refus, code parent… */
  function journee(usage, demandes, config, etat, maintenant) {
    var lignes = [];
    var D = S.CHAMP_DEMANDE;
    var St = S.VALEUR.statutDemande;
    var noms = estObjet(usage) && estObjet(usage[S.CHAMP_USAGE.nomsApplis]) ? usage[S.CHAMP_USAGE.nomsApplis] : {};
    demandesDuJour(demandes, maintenant).forEach(function (d) {
      var st = d[D.statut];
      var qui = nomParent(config, d[D.traitePar]);
      var suite = st === St.acceptee ? ' → accepté (' + qui + ')'
        : st === St.refusee ? ' → refusé (' + qui + ')'
        : st === St.traitee ? ' → vu (' + qui + ')'
        : ' → en attente';
      lignes.push({ quand: enMs(d[D.creeeLe]), texte: titreDemande(d, noms, etat) + ' demandé' + suite });
    });
    if (estObjet(usage)) {
      var U = S.CHAMP_USAGE;
      var Ev = S.CHAMP_EVENEMENT;
      var liste = function (v) { return Object.prototype.toString.call(v) === '[object Array]' ? v.filter(estObjet) : []; };
      var quand = function (e) { return enMs(e[Ev.quand]) || enMs(e[Ev.date]); };
      liste(usage[U.lancementsRefuses]).forEach(function (e) {
        var id = texte(e[Ev.appli]);
        lignes.push({ quand: quand(e), texte: (id ? nomAppli(id, noms, etat) : 'Une appli') + ' refusé' });
      });
      liste(usage[U.codeParent]).forEach(function (e) {
        var ok = e[Ev.resultat] === S.VALEUR.resultatCode.ok;
        lignes.push({ quand: quand(e), texte: ok ? 'Code parent tapé sur le PC' : 'Code parent erroné' });
      });
      liste(usage[U.executablesInconnus]).forEach(function (e) {
        var chemin = texte(e[Ev.executable]);
        var nom = chemin ? chemin.split(/[\\\/]/).pop() : null;
        lignes.push({ quand: quand(e), texte: 'Programme inconnu' + (nom ? ' « ' + nom + ' »' : '') + ' lancé' });
      });
      liste(usage[U.vpnBloques]).forEach(function (e) {
        lignes.push({ quand: quand(e), texte: 'VPN bloqué' });
      });
    }
    lignes.sort(function (a, b) { return (a.quand || 0) - (b.quand || 0); });
    return lignes.map(function (l) { return { heure: l.quand ? heure(l.quand) : '', texte: l.texte }; });
  }

  /* reports/nextdns (brut) → sites du jour ; `note` quand il n'y a rien à montrer. */
  function internetDuJour(rapport, maintenant) {
    if (!estObjet(rapport)) return { visites: [], bloques: [], note: "Le filtre internet n'est pas encore relié." };
    var R = S.CHAMP_RAPPORT;
    if (rapport[R.jour] !== jourLocal(maintenant)) {
      return { visites: [], bloques: [], note: "Pas encore de relevé aujourd'hui." };
    }
    function sites(v, max) {
      if (Object.prototype.toString.call(v) !== '[object Array]') return [];
      return v.filter(estObjet).map(function (s) {
        return { site: texte(s[S.CHAMP_SITE.domaine]) || '', n: nombre(s[S.CHAMP_SITE.requetes]) };
      }).filter(function (s) { return s.site; }).slice(0, max);
    }
    var visites = sites(rapport[R.visites], MAX_SITES);
    var bloques = sites(rapport[R.bloques], MAX_BLOQUES);
    return { visites: visites, bloques: bloques, note: visites.length || bloques.length ? '' : "Aucun site aujourd'hui." };
  }

  /* Tout le rapport plein écran, prêt à dessiner. */
  function rapport(d, maintenant) {
    var etat = lireEtat(d.statut);
    var f = fraicheur(etat ? etat.vuLe : null, maintenant);
    var noms = estObjet(d.usage) && estObjet(d.usage[S.CHAMP_USAGE.nomsApplis]) ? d.usage[S.CHAMP_USAGE.nomsApplis] : {};
    var carte = resumeCarte(etat, 0, maintenant);
    var attente = demandesDuJour(d.demandes, maintenant).filter(enAttente).map(function (x) {
      var msg = texte(x[S.CHAMP_DEMANDE.message]);
      var t = enMs(x[S.CHAMP_DEMANDE.creeeLe]);
      return { texte: titreDemande(x, noms, etat), message: msg, heure: t ? heure(t) : '' };
    });
    var secondes = estObjet(d.usage) ? nombre(d.usage[S.CHAMP_USAGE.secondesSession]) : 0;
    return {
      titre: carte.titre,
      rouge: carte.rouge,
      permet: etat ? cePermet(etat.mode.valeur, etat.reseau) : '',
      origine: carte.detail,
      temps: dureeSecondesTexte(secondes),
      enLigne: f.enLigne,
      ligne: f.court,
      vu: f.long,
      attente: attente,
      applis: applisDuJour(d.usage, etat),
      internet: internetDuJour(d.rapport, maintenant),
      journee: journee(d.usage, d.demandes, d.config, etat, maintenant)
    };
  }

  /* ===================== Données en direct ===================== */

  var donnees = { config: null, appareilId: null, statut: null, usage: null, demandes: [], rapport: null };
  var abos = { config: null, statut: null, journee: null, demandes: null, rapport: null };
  var jourEcoute = null;
  var contexte = null;
  var dernierRafraichissement = 0;
  var vue = null;

  function prevenir() {
    if (contexte && contexte.surChangement) {
      try { contexte.surChangement(); } catch (e) { /* le tableau journalise ses erreurs */ }
    }
    if (vue) dessiner();
  }

  function couper(nom) {
    if (abos[nom]) { try { abos[nom](); } catch (e) { /* déjà coupé */ } abos[nom] = null; }
  }

  function journal(quoi, err) {
    if (root.console && root.console.warn) root.console.warn('[pc-enfants] ' + quoi, err);
  }

  /* Un abonnement mort (réseau, droits) est repris une minute plus tard. */
  function reprendre(nom, attacher) {
    return function (err) {
      journal(nom, err);
      abos[nom] = null;
      setTimeout(function () { if (contexte && !abos[nom]) attacher(); }, 60000);
    };
  }

  function appareilRef() {
    return contexte.db.collection(S.COLLECTION_APPAREILS).doc(donnees.appareilId);
  }

  function ecouterUsage() {
    couper('journee');
    if (!donnees.appareilId) return;
    jourEcoute = jourLocal(Date.now());
    abos.journee = appareilRef().collection(S.SOUS_COLLECTION.usage).doc(jourEcoute)
      .onSnapshot(function (s) { donnees.usage = s.exists ? s.data() : null; prevenir(); },
        reprendre('journee', ecouterUsage));
  }

  function ecouterAppareil() {
    var ref = appareilRef();
    couper('statut');
    abos.statut = ref.collection(S.SOUS_COLLECTION.etat).doc(S.DOC_ETAT_COURANT)
      .onSnapshot(function (s) { donnees.statut = s.exists ? s.data() : null; prevenir(); },
        reprendre('statut', ecouterAppareil));
    couper('demandes');
    abos.demandes = ref.collection(S.SOUS_COLLECTION.demandes)
      .orderBy(S.CHAMP_DEMANDE.creeeLe, 'desc').limit(40)
      .onSnapshot(function (q) {
        var liste = [];
        q.forEach(function (doc) { liste.push(doc.data() || {}); });
        donnees.demandes = liste;
        prevenir();
      }, reprendre('demandes', ecouterAppareil));
    couper('rapport');
    abos.rapport = ref.collection(S.SOUS_COLLECTION_RAPPORTS).doc(S.DOC_RAPPORT_NEXTDNS)
      .onSnapshot(function (s) { donnees.rapport = s.exists ? s.data() : null; prevenir(); },
        reprendre('rapport', ecouterAppareil));
    ecouterUsage();
  }

  function ecouterConfig() {
    couper('config');
    abos.config = contexte.db.collection(S.COLLECTION_APPAREILS)
      .where(S.CHAMP_CONFIG.foyer, '==', contexte.foyerId).limit(1)
      .onSnapshot(function (q) {
        var doc = null;
        q.forEach(function (d) { if (!doc) doc = d; });
        var id = doc ? doc.id : null;
        donnees.config = doc ? doc.data() : null;
        if (id !== donnees.appareilId) {
          donnees.appareilId = id;
          donnees.statut = null; donnees.usage = null; donnees.demandes = []; donnees.rapport = null;
          ['statut', 'journee', 'demandes', 'rapport'].forEach(couper);
          if (id) ecouterAppareil();
        }
        prevenir();
      }, reprendre('config', ecouterConfig));
  }

  function demarrer(db, functions, foyerId, surChangement) {
    if (!S || !db || !foyerId) return;
    if (contexte && contexte.foyerId === foyerId) { contexte.surChangement = surChangement; return; }
    contexte = { db: db, functions: functions, foyerId: foyerId, surChangement: surChangement };
    ecouterConfig();
    /* Minuit : on passe au document d'usage du nouveau jour. */
    setInterval(function () {
      if (donnees.appareilId && jourLocal(Date.now()) !== jourEcoute) ecouterUsage();
    }, 60000);
  }

  /* Le relevé internet n'est refait qu'à la demande : à l'ouverture du
     rapport, au plus toutes les 5 minutes (le serveur a la même borne). */
  function rafraichirInternet() {
    if (!contexte || !contexte.functions || !donnees.appareilId) return;
    if (Date.now() - dernierRafraichissement < 5 * 60000) return;
    dernierRafraichissement = Date.now();
    var demande = {};
    demande.appareilId = donnees.appareilId;
    demande.action = S.ACTION_NEXTDNS.rapport;
    try {
      contexte.functions.httpsCallable(S.FONCTION_NEXTDNS)(demande).then(null, function (e) { journal('internet', e); });
    } catch (e) { journal('internet', e); }
  }

  function enAttenteCompte() {
    return demandesDuJour(donnees.demandes, Date.now()).filter(enAttente).length;
  }

  /* Pour le tableau : null tant que le foyer n'a pas de PC relié. */
  function carte(maintenant) {
    if (!S || !donnees.appareilId) return null;
    return resumeCarte(lireEtat(donnees.statut), enAttenteCompte(), maintenant || Date.now());
  }

  /* ===================== Plein écran ===================== */

  function echapper(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  var CLOCHE = '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" fill="none" stroke="currentColor" ' +
    'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>' +
    '<path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>';

  function bloc(titre, corps) {
    return '<div class="pce-bloc fh-carte fh-bordure"><div class="pce-bloc-titre fh-texte-doux">' + echapper(titre) +
      '</div><div class="pce-bloc-corps">' + corps + '</div></div>';
  }

  function html(r) {
    var h = '';
    h += '<div class="pce-bandeau fh-carte fh-bordure">' +
      '<div class="pce-bandeau-mode"><div class="pce-mode fh-titre' + (r.rouge ? ' pce-rouge' : '') + '">' + echapper(r.titre) + '</div>' +
      '<div class="pce-sous fh-texte">' + echapper(r.permet) + '</div>' +
      '<div class="pce-sous fh-texte-doux">' + echapper(r.origine) + '</div></div>' +
      '<div class="pce-chiffre"><div class="pce-temps fh-titre">' + echapper(r.temps) + '</div>' +
      '<div class="pce-legende fh-texte-doux">aujourd\'hui</div></div>' +
      '<div class="pce-chiffre"><div class="pce-ligne ' + (r.enLigne ? 'pce-vert' : 'fh-texte-doux') + '">' +
      '<span class="pce-point"></span>' + echapper(r.enLigne ? 'En ligne' : 'Hors ligne') + '</div>' +
      '<div class="pce-legende fh-texte-doux">' + echapper(r.vu) + '</div></div></div>';
    r.attente.forEach(function (a) {
      h += '<div class="pce-attente fh-maintenant">' + CLOCHE +
        '<span class="pce-attente-texte"><b>Demande en attente : ' + echapper(a.texte.charAt(0).toLowerCase() + a.texte.slice(1)) + '</b>' +
        (a.message ? ' · « ' + echapper(a.message) + ' »' : '') + (a.heure ? ' · ' + echapper(a.heure) : '') + '</span>' +
        '<span class="pce-attente-ou">À valider sur un téléphone</span></div>';
    });
    var applis = r.applis.length ? '' : '<div class="pce-vide fh-texte-doux">Pas encore de temps passé aujourd\'hui.</div>';
    r.applis.forEach(function (a) {
      applis += '<div class="pce-appli"><div class="pce-appli-ligne"><span>' + echapper(a.nom) + '</span>' +
        '<span class="fh-texte-doux">' + echapper(a.duree) + '</span></div>' +
        '<div class="pce-barre"><div class="pce-barre-plein" style="width:' + a.part + '%"></div></div></div>';
    });
    var net = '';
    r.internet.visites.forEach(function (s) {
      net += '<div class="pce-site"><span>' + echapper(s.site) + '</span><span class="fh-texte-doux">' + s.n + '</span></div>';
    });
    if (r.internet.bloques.length) {
      net += '<div class="pce-sous-titre fh-texte-doux">Bloqués</div>';
      r.internet.bloques.forEach(function (s) {
        net += '<div class="pce-site"><span>' + echapper(s.site) + '</span><span class="pce-rouge">' + s.n + '</span></div>';
      });
    }
    if (r.internet.note) net += '<div class="pce-vide fh-texte-doux">' + echapper(r.internet.note) + '</div>';
    var jour = r.journee.length ? '' : '<div class="pce-vide fh-texte-doux">Rien à signaler aujourd\'hui.</div>';
    r.journee.forEach(function (l) {
      jour += '<div class="pce-evt"><span class="pce-evt-heure fh-texte-doux">' + echapper(l.heure) + '</span>' +
        '<span class="pce-evt-texte">' + echapper(l.texte) + '</span></div>';
    });
    h += '<div class="pce-blocs">' + bloc('Applis', applis) + bloc('Internet', net) + bloc('La journée', jour) + '</div>';
    return h;
  }

  function dessiner() {
    if (!vue) return;
    if (!donnees.appareilId) {
      vue.innerHTML = '<div class="fh-pe-message fh-texte">Le PC n\'est pas encore relié à Family Hub.</div>';
      return;
    }
    vue.innerHTML = html(rapport(donnees, Date.now()));
  }

  var minuteur = null;
  if (root) {
    root.Tiles = root.Tiles || {};
    root.Tiles['pc-enfants'] = {
      expand: function (content, data) {
        vue = content;
        content.className += ' pce';
        var tete = root.FamilyHubOverlay && root.FamilyHubOverlay.tete();
        if (tete) tete.innerHTML = '<div class="pce-titre fh-titre fh-texte">' + echapper((data && data.titre) || 'PC des enfants') + '</div>';
        rafraichirInternet();
        dessiner();
        /* « vu il y a 3 min » avance même sans nouvelle donnée. */
        minuteur = setInterval(dessiner, 30000);
      },
      collapse: function () {
        vue = null;
        if (minuteur) { clearInterval(minuteur); minuteur = null; }
      }
    };
  }

  var api = {
    enMs: enMs,
    heure: heure,
    jusquaTexte: jusquaTexte,
    dureeTexte: dureeTexte,
    lireEtat: lireEtat,
    fraicheur: fraicheur,
    resumeCarte: resumeCarte,
    applisDuJour: applisDuJour,
    titreDemande: titreDemande,
    journee: journee,
    internetDuJour: internetDuJour,
    rapport: rapport,
    html: html,
    demarrer: demarrer,
    carte: carte
  };

  if (root) root.FamilyHubPc = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : null);
