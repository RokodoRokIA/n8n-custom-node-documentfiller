"use strict";
/**
 * Schéma de tags standardisé pour les marchés publics français
 *
 * Ce fichier définit tous les tags utilisables dans les templates DOCX
 * pour les formulaires DC1, DC2, AE (ATTRI1) et autres documents administratifs.
 *
 * Format des données JSON attendu: voir DATA_SCHEMA ci-dessous
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TAG_TO_PATH = exports.TAGS = void 0;
exports.getNestedValue = getNestedValue;
exports.mapDataToTags = mapDataToTags;
exports.getAvailableTagsByCategory = getAvailableTagsByCategory;
// ============================================================================
// TAGS STANDARDISÉS
// ============================================================================
exports.TAGS = {
    // ─────────────────────────────────────────────────────────────────────────
    // ENTREPRISE - Identification
    // ─────────────────────────────────────────────────────────────────────────
    NOM_COMMERCIAL: 'NOM_COMMERCIAL', // Nom commercial de l'entreprise
    DENOMINATION: 'DENOMINATION', // Dénomination sociale
    SIRET: 'SIRET', // Numéro SIRET (14 chiffres)
    SIREN: 'SIREN', // Numéro SIREN (9 chiffres)
    ADRESSE: 'ADRESSE', // Adresse de l'établissement
    ADRESSE_SIEGE: 'ADRESSE_SIEGE', // Adresse du siège social
    EMAIL: 'EMAIL', // Email principal
    EMAIL_CONTACT: 'EMAIL_CONTACT', // Email de contact
    TELEPHONE: 'TELEPHONE', // Téléphone
    FAX: 'FAX', // Fax
    FORME_JURIDIQUE: 'FORME_JURIDIQUE', // SAS, SARL, SA, etc.
    SITE_WEB: 'SITE_WEB', // Site internet
    // ─────────────────────────────────────────────────────────────────────────
    // REGISTRE PROFESSIONNEL
    // ─────────────────────────────────────────────────────────────────────────
    INSCRIPTION_REGISTRE: 'INSCRIPTION_REGISTRE', // Inscription au registre
    CERTIFICATIONS: 'CERTIFICATIONS', // Liste des certifications
    DESCRIPTION_PARTENARIAT: 'DESCRIPTION_PARTENARIAT',
    DESCRIPTION_ACTIVITE: 'DESCRIPTION_ACTIVITE',
    // ─────────────────────────────────────────────────────────────────────────
    // CHIFFRES D'AFFAIRES (3 dernières années)
    // ─────────────────────────────────────────────────────────────────────────
    CA_N: 'CA_N', // CA année N (la plus récente)
    CA_N_ANNEE: 'CA_N_ANNEE', // Année N
    CA_N_DEBUT: 'CA_N_DEBUT', // Date début exercice N
    CA_N_FIN: 'CA_N_FIN', // Date fin exercice N
    CA_N1: 'CA_N1', // CA année N-1
    CA_N1_ANNEE: 'CA_N1_ANNEE',
    CA_N1_DEBUT: 'CA_N1_DEBUT',
    CA_N1_FIN: 'CA_N1_FIN',
    CA_N2: 'CA_N2', // CA année N-2
    CA_N2_ANNEE: 'CA_N2_ANNEE',
    CA_N2_DEBUT: 'CA_N2_DEBUT',
    CA_N2_FIN: 'CA_N2_FIN',
    PART_CA: 'PART_CA', // Part du CA concernant l'activité
    // ─────────────────────────────────────────────────────────────────────────
    // GROUPEMENT - Membre du groupement (tableau B1 dans AE)
    // ─────────────────────────────────────────────────────────────────────────
    MEMBRE_GROUPE_NOM: 'MEMBRE_GROUPE_NOM', // Nom de l'entreprise qui remplit
    MEMBRE_GROUPE_ADRESSE: 'MEMBRE_GROUPE_ADRESSE',
    MEMBRE_GROUPE_ADRESSE_SIEGE: 'MEMBRE_GROUPE_ADRESSE_SIEGE',
    MEMBRE_GROUPE_EMAIL: 'MEMBRE_GROUPE_EMAIL',
    MEMBRE_GROUPE_TELEPHONE: 'MEMBRE_GROUPE_TELEPHONE',
    MEMBRE_GROUPE_SIRET: 'MEMBRE_GROUPE_SIRET',
    // ─────────────────────────────────────────────────────────────────────────
    // GROUPEMENT - Mandataire
    // ─────────────────────────────────────────────────────────────────────────
    MANDATAIRE_NOM: 'MANDATAIRE_NOM',
    MANDATAIRE_ADRESSE: 'MANDATAIRE_ADRESSE',
    MANDATAIRE_EMAIL: 'MANDATAIRE_EMAIL',
    MANDATAIRE_TELEPHONE: 'MANDATAIRE_TELEPHONE',
    MANDATAIRE_SIRET: 'MANDATAIRE_SIRET',
    TYPE_GROUPEMENT: 'TYPE_GROUPEMENT', // "conjoint" ou "solidaire"
    // ─────────────────────────────────────────────────────────────────────────
    // SIGNATAIRE
    // ─────────────────────────────────────────────────────────────────────────
    SIGNATAIRE_NOM: 'SIGNATAIRE_NOM',
    SIGNATAIRE_PRENOM: 'SIGNATAIRE_PRENOM',
    SIGNATAIRE_QUALITE: 'SIGNATAIRE_QUALITE', // Directeur Général, Président, etc.
    SIGNATAIRE_COMPLET: 'SIGNATAIRE_COMPLET', // "Prénom NOM, Qualité"
    // ─────────────────────────────────────────────────────────────────────────
    // CHECKBOXES (rendu: ☑ ou ☐)
    // ─────────────────────────────────────────────────────────────────────────
    CHECK_CANDIDAT_SEUL: 'CHECK_CANDIDAT_SEUL',
    CHECK_GROUPEMENT: 'CHECK_GROUPEMENT',
    CHECK_GROUPEMENT_CONJOINT: 'CHECK_GROUPEMENT_CONJOINT',
    CHECK_GROUPEMENT_SOLIDAIRE: 'CHECK_GROUPEMENT_SOLIDAIRE',
    CHECK_MANDATAIRE_SOLIDAIRE_OUI: 'CHECK_MANDATAIRE_SOLIDAIRE_OUI',
    CHECK_MANDATAIRE_SOLIDAIRE_NON: 'CHECK_MANDATAIRE_SOLIDAIRE_NON',
    CHECK_MANDAT_SIGNATURE: 'CHECK_MANDAT_SIGNATURE',
    CHECK_MANDAT_MODIFICATIONS: 'CHECK_MANDAT_MODIFICATIONS',
    CHECK_PME: 'CHECK_PME',
    CHECK_NON_PME: 'CHECK_NON_PME',
    // ─────────────────────────────────────────────────────────────────────────
    // DATE ET LIEU
    // ─────────────────────────────────────────────────────────────────────────
    DATE_SIGNATURE: 'DATE_SIGNATURE',
    LIEU_SIGNATURE: 'LIEU_SIGNATURE',
};
// ============================================================================
// MAPPING TAGS → CHEMIN JSON
// ============================================================================
exports.TAG_TO_PATH = {
    // Entreprise
    [exports.TAGS.NOM_COMMERCIAL]: 'entreprise.nom_commercial',
    [exports.TAGS.DENOMINATION]: 'entreprise.denomination_sociale',
    [exports.TAGS.SIRET]: 'entreprise.siret',
    [exports.TAGS.SIREN]: 'entreprise.siret', // Sera tronqué à 9 chiffres
    [exports.TAGS.ADRESSE]: 'entreprise.adresse',
    [exports.TAGS.ADRESSE_SIEGE]: 'entreprise.adresse_siege',
    [exports.TAGS.EMAIL]: 'entreprise.email',
    [exports.TAGS.EMAIL_CONTACT]: 'entreprise.email_contact',
    [exports.TAGS.TELEPHONE]: 'entreprise.telephone',
    [exports.TAGS.FAX]: 'entreprise.fax',
    [exports.TAGS.FORME_JURIDIQUE]: 'entreprise.forme_juridique',
    [exports.TAGS.SITE_WEB]: 'entreprise.site_web',
    // Registre
    [exports.TAGS.INSCRIPTION_REGISTRE]: 'registre_professionnel.inscription',
    [exports.TAGS.CERTIFICATIONS]: 'registre_professionnel.certifications',
    [exports.TAGS.DESCRIPTION_PARTENARIAT]: 'registre_professionnel.description_partenariat',
    [exports.TAGS.DESCRIPTION_ACTIVITE]: 'registre_professionnel.description_activite',
    // CA
    [exports.TAGS.CA_N]: 'chiffres_affaires.n.ca_global',
    [exports.TAGS.CA_N_ANNEE]: 'chiffres_affaires.n.annee',
    [exports.TAGS.CA_N_DEBUT]: 'chiffres_affaires.n.debut',
    [exports.TAGS.CA_N_FIN]: 'chiffres_affaires.n.fin',
    [exports.TAGS.CA_N1]: 'chiffres_affaires.n1.ca_global',
    [exports.TAGS.CA_N1_ANNEE]: 'chiffres_affaires.n1.annee',
    [exports.TAGS.CA_N1_DEBUT]: 'chiffres_affaires.n1.debut',
    [exports.TAGS.CA_N1_FIN]: 'chiffres_affaires.n1.fin',
    [exports.TAGS.CA_N2]: 'chiffres_affaires.n2.ca_global',
    [exports.TAGS.CA_N2_ANNEE]: 'chiffres_affaires.n2.annee',
    [exports.TAGS.CA_N2_DEBUT]: 'chiffres_affaires.n2.debut',
    [exports.TAGS.CA_N2_FIN]: 'chiffres_affaires.n2.fin',
    [exports.TAGS.PART_CA]: 'chiffres_affaires.part_ca_percent',
    // Groupement
    [exports.TAGS.MEMBRE_GROUPE_NOM]: 'groupement.membre_groupe.nom',
    [exports.TAGS.MEMBRE_GROUPE_ADRESSE]: 'groupement.membre_groupe.adresse',
    [exports.TAGS.MEMBRE_GROUPE_ADRESSE_SIEGE]: 'groupement.membre_groupe.adresse_siege',
    [exports.TAGS.MEMBRE_GROUPE_EMAIL]: 'groupement.membre_groupe.email',
    [exports.TAGS.MEMBRE_GROUPE_TELEPHONE]: 'groupement.membre_groupe.telephone',
    [exports.TAGS.MEMBRE_GROUPE_SIRET]: 'groupement.membre_groupe.siret',
    [exports.TAGS.MANDATAIRE_NOM]: 'groupement.mandataire.nom_commercial',
    [exports.TAGS.MANDATAIRE_ADRESSE]: 'groupement.mandataire.adresse',
    [exports.TAGS.MANDATAIRE_EMAIL]: 'groupement.mandataire.email',
    [exports.TAGS.MANDATAIRE_TELEPHONE]: 'groupement.mandataire.telephone',
    [exports.TAGS.MANDATAIRE_SIRET]: 'groupement.mandataire.siret',
    [exports.TAGS.TYPE_GROUPEMENT]: 'groupement.type',
    // Signataire
    [exports.TAGS.SIGNATAIRE_NOM]: 'signataire.nom',
    [exports.TAGS.SIGNATAIRE_PRENOM]: 'signataire.prenom',
    [exports.TAGS.SIGNATAIRE_QUALITE]: 'signataire.qualite',
    [exports.TAGS.SIGNATAIRE_COMPLET]: 'signataire.complet',
    // Checkboxes
    [exports.TAGS.CHECK_CANDIDAT_SEUL]: 'checkboxes.candidat_seul',
    [exports.TAGS.CHECK_GROUPEMENT]: 'checkboxes.groupement',
    [exports.TAGS.CHECK_GROUPEMENT_CONJOINT]: 'checkboxes.groupement_conjoint',
    [exports.TAGS.CHECK_GROUPEMENT_SOLIDAIRE]: 'checkboxes.groupement_solidaire',
    [exports.TAGS.CHECK_MANDATAIRE_SOLIDAIRE_OUI]: 'checkboxes.mandataire_solidaire_oui',
    [exports.TAGS.CHECK_MANDATAIRE_SOLIDAIRE_NON]: 'checkboxes.mandataire_solidaire_non',
    [exports.TAGS.CHECK_MANDAT_SIGNATURE]: 'checkboxes.mandat_signature',
    [exports.TAGS.CHECK_MANDAT_MODIFICATIONS]: 'checkboxes.mandat_modifications',
    [exports.TAGS.CHECK_PME]: 'checkboxes.pme',
    [exports.TAGS.CHECK_NON_PME]: 'checkboxes.non_pme',
    // Date/Lieu
    [exports.TAGS.DATE_SIGNATURE]: 'date_signature',
    [exports.TAGS.LIEU_SIGNATURE]: 'lieu_signature',
};
// ============================================================================
// UTILITAIRES
// ============================================================================
/**
 * Récupère une valeur imbriquée dans un objet via un chemin "a.b.c"
 */
function getNestedValue(obj, path) {
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
        if (current === null || current === undefined)
            return '';
        current = current[part];
    }
    return current !== null && current !== void 0 ? current : '';
}
/**
 * Convertit les données JSON en un objet plat avec les tags standardisés
 */
function mapDataToTags(data) {
    var _a;
    const result = {};
    for (const [tag, path] of Object.entries(exports.TAG_TO_PATH)) {
        let value = getNestedValue(data, path);
        // Traitement spécial pour SIREN (9 premiers chiffres du SIRET)
        if (tag === exports.TAGS.SIREN && typeof value === 'string') {
            value = value.replace(/\s/g, '').substring(0, 9);
        }
        // Traitement des checkboxes
        if (tag.startsWith('CHECK_')) {
            result[tag] = value === true || value === 'true' ? '☑' : '☐';
        }
        // Traitement des tableaux
        else if (Array.isArray(value)) {
            result[tag] = value.join(', ');
        }
        // Valeurs normales
        else {
            result[tag] = value !== null && value !== undefined ? String(value) : '';
        }
    }
    // Ajouter les membres du groupement pour les boucles docxtemplater
    if (((_a = data.groupement) === null || _a === void 0 ? void 0 : _a.membres) && Array.isArray(data.groupement.membres)) {
        result.membres = data.groupement.membres.map((m, idx) => ({
            MEMBRE_NUM: idx + 1,
            MEMBRE_NOM: m.nom || '',
            MEMBRE_PRESTATION: m.prestation || '',
            MEMBRE_MONTANT: m.montant || '',
        }));
    }
    return result;
}
/**
 * Liste tous les tags disponibles par catégorie
 */
function getAvailableTagsByCategory() {
    return {
        'Entreprise': [
            exports.TAGS.NOM_COMMERCIAL,
            exports.TAGS.DENOMINATION,
            exports.TAGS.SIRET,
            exports.TAGS.SIREN,
            exports.TAGS.ADRESSE,
            exports.TAGS.ADRESSE_SIEGE,
            exports.TAGS.EMAIL,
            exports.TAGS.EMAIL_CONTACT,
            exports.TAGS.TELEPHONE,
            exports.TAGS.FAX,
            exports.TAGS.FORME_JURIDIQUE,
            exports.TAGS.SITE_WEB,
        ],
        'Registre Professionnel': [
            exports.TAGS.INSCRIPTION_REGISTRE,
            exports.TAGS.CERTIFICATIONS,
            exports.TAGS.DESCRIPTION_PARTENARIAT,
            exports.TAGS.DESCRIPTION_ACTIVITE,
        ],
        'Chiffres d\'Affaires': [
            exports.TAGS.CA_N,
            exports.TAGS.CA_N_ANNEE,
            exports.TAGS.CA_N1,
            exports.TAGS.CA_N1_ANNEE,
            exports.TAGS.CA_N2,
            exports.TAGS.CA_N2_ANNEE,
            exports.TAGS.PART_CA,
        ],
        'Groupement - Membre': [
            exports.TAGS.MEMBRE_GROUPE_NOM,
            exports.TAGS.MEMBRE_GROUPE_ADRESSE,
            exports.TAGS.MEMBRE_GROUPE_ADRESSE_SIEGE,
            exports.TAGS.MEMBRE_GROUPE_EMAIL,
            exports.TAGS.MEMBRE_GROUPE_TELEPHONE,
            exports.TAGS.MEMBRE_GROUPE_SIRET,
        ],
        'Groupement - Mandataire': [
            exports.TAGS.MANDATAIRE_NOM,
            exports.TAGS.MANDATAIRE_ADRESSE,
            exports.TAGS.MANDATAIRE_EMAIL,
            exports.TAGS.MANDATAIRE_TELEPHONE,
            exports.TAGS.MANDATAIRE_SIRET,
            exports.TAGS.TYPE_GROUPEMENT,
        ],
        'Signataire': [
            exports.TAGS.SIGNATAIRE_NOM,
            exports.TAGS.SIGNATAIRE_PRENOM,
            exports.TAGS.SIGNATAIRE_QUALITE,
            exports.TAGS.SIGNATAIRE_COMPLET,
        ],
        'Checkboxes': [
            exports.TAGS.CHECK_CANDIDAT_SEUL,
            exports.TAGS.CHECK_GROUPEMENT,
            exports.TAGS.CHECK_GROUPEMENT_CONJOINT,
            exports.TAGS.CHECK_GROUPEMENT_SOLIDAIRE,
            exports.TAGS.CHECK_MANDATAIRE_SOLIDAIRE_OUI,
            exports.TAGS.CHECK_MANDATAIRE_SOLIDAIRE_NON,
            exports.TAGS.CHECK_PME,
            exports.TAGS.CHECK_NON_PME,
        ],
        'Date/Lieu': [exports.TAGS.DATE_SIGNATURE, exports.TAGS.LIEU_SIGNATURE],
    };
}
