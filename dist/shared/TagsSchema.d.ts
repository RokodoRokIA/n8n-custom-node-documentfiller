/**
 * Schéma de tags standardisé pour les marchés publics français
 *
 * Ce fichier définit tous les tags utilisables dans les templates DOCX
 * pour les formulaires DC1, DC2, AE (ATTRI1) et autres documents administratifs.
 *
 * Format des données JSON attendu: voir DATA_SCHEMA ci-dessous
 */
export declare const TAGS: {
    readonly NOM_COMMERCIAL: "NOM_COMMERCIAL";
    readonly DENOMINATION: "DENOMINATION";
    readonly SIRET: "SIRET";
    readonly SIREN: "SIREN";
    readonly ADRESSE: "ADRESSE";
    readonly ADRESSE_SIEGE: "ADRESSE_SIEGE";
    readonly EMAIL: "EMAIL";
    readonly EMAIL_CONTACT: "EMAIL_CONTACT";
    readonly TELEPHONE: "TELEPHONE";
    readonly FAX: "FAX";
    readonly FORME_JURIDIQUE: "FORME_JURIDIQUE";
    readonly SITE_WEB: "SITE_WEB";
    readonly INSCRIPTION_REGISTRE: "INSCRIPTION_REGISTRE";
    readonly CERTIFICATIONS: "CERTIFICATIONS";
    readonly DESCRIPTION_PARTENARIAT: "DESCRIPTION_PARTENARIAT";
    readonly DESCRIPTION_ACTIVITE: "DESCRIPTION_ACTIVITE";
    readonly CA_N: "CA_N";
    readonly CA_N_ANNEE: "CA_N_ANNEE";
    readonly CA_N_DEBUT: "CA_N_DEBUT";
    readonly CA_N_FIN: "CA_N_FIN";
    readonly CA_N1: "CA_N1";
    readonly CA_N1_ANNEE: "CA_N1_ANNEE";
    readonly CA_N1_DEBUT: "CA_N1_DEBUT";
    readonly CA_N1_FIN: "CA_N1_FIN";
    readonly CA_N2: "CA_N2";
    readonly CA_N2_ANNEE: "CA_N2_ANNEE";
    readonly CA_N2_DEBUT: "CA_N2_DEBUT";
    readonly CA_N2_FIN: "CA_N2_FIN";
    readonly PART_CA: "PART_CA";
    readonly MEMBRE_GROUPE_NOM: "MEMBRE_GROUPE_NOM";
    readonly MEMBRE_GROUPE_ADRESSE: "MEMBRE_GROUPE_ADRESSE";
    readonly MEMBRE_GROUPE_ADRESSE_SIEGE: "MEMBRE_GROUPE_ADRESSE_SIEGE";
    readonly MEMBRE_GROUPE_EMAIL: "MEMBRE_GROUPE_EMAIL";
    readonly MEMBRE_GROUPE_TELEPHONE: "MEMBRE_GROUPE_TELEPHONE";
    readonly MEMBRE_GROUPE_SIRET: "MEMBRE_GROUPE_SIRET";
    readonly MANDATAIRE_NOM: "MANDATAIRE_NOM";
    readonly MANDATAIRE_ADRESSE: "MANDATAIRE_ADRESSE";
    readonly MANDATAIRE_EMAIL: "MANDATAIRE_EMAIL";
    readonly MANDATAIRE_TELEPHONE: "MANDATAIRE_TELEPHONE";
    readonly MANDATAIRE_SIRET: "MANDATAIRE_SIRET";
    readonly TYPE_GROUPEMENT: "TYPE_GROUPEMENT";
    readonly SIGNATAIRE_NOM: "SIGNATAIRE_NOM";
    readonly SIGNATAIRE_PRENOM: "SIGNATAIRE_PRENOM";
    readonly SIGNATAIRE_QUALITE: "SIGNATAIRE_QUALITE";
    readonly SIGNATAIRE_COMPLET: "SIGNATAIRE_COMPLET";
    readonly CHECK_CANDIDAT_SEUL: "CHECK_CANDIDAT_SEUL";
    readonly CHECK_GROUPEMENT: "CHECK_GROUPEMENT";
    readonly CHECK_GROUPEMENT_CONJOINT: "CHECK_GROUPEMENT_CONJOINT";
    readonly CHECK_GROUPEMENT_SOLIDAIRE: "CHECK_GROUPEMENT_SOLIDAIRE";
    readonly CHECK_MANDATAIRE_SOLIDAIRE_OUI: "CHECK_MANDATAIRE_SOLIDAIRE_OUI";
    readonly CHECK_MANDATAIRE_SOLIDAIRE_NON: "CHECK_MANDATAIRE_SOLIDAIRE_NON";
    readonly CHECK_MANDAT_SIGNATURE: "CHECK_MANDAT_SIGNATURE";
    readonly CHECK_MANDAT_MODIFICATIONS: "CHECK_MANDAT_MODIFICATIONS";
    readonly CHECK_PME: "CHECK_PME";
    readonly CHECK_NON_PME: "CHECK_NON_PME";
    readonly DATE_SIGNATURE: "DATE_SIGNATURE";
    readonly LIEU_SIGNATURE: "LIEU_SIGNATURE";
};
export declare const TAG_TO_PATH: Record<string, string>;
/**
 * Structure JSON attendue pour remplir les templates
 *
 * @example
 * {
 *   "entreprise": {
 *     "nom_commercial": "ROKODO.IO",
 *     "denomination_sociale": "ROKODO.IO SAS",
 *     "siret": "89198692900018",
 *     "adresse": "13 rue Camille Desmoulins 92130 Issy-Les-Moulineaux",
 *     "email": "contact@rokodo.io",
 *     "telephone": "+33 689 09 33 41"
 *   },
 *   "chiffres_affaires": {
 *     "n": { "annee": "2023", "ca_global": "1 080 000 €" },
 *     "n1": { "annee": "2022", "ca_global": "527 000 €" },
 *     "n2": { "annee": "2021", "ca_global": "560 000 €" }
 *   },
 *   "groupement": {
 *     "est_groupement": false,
 *     "membre_groupe": { ... }
 *   },
 *   "checkboxes": {
 *     "candidat_seul": true,
 *     "pme": true
 *   }
 * }
 */
export interface DataSchema {
    entreprise: {
        nom_commercial: string;
        denomination_sociale?: string;
        siret: string;
        adresse: string;
        adresse_siege?: string;
        email: string;
        email_contact?: string;
        telephone: string;
        fax?: string;
        forme_juridique?: string;
        site_web?: string;
    };
    registre_professionnel?: {
        inscription?: string;
        certifications?: string[];
        description_partenariat?: string;
        description_activite?: string;
    };
    legal?: {
        statut_pme?: boolean;
        type_candidature?: 'seul' | 'groupement';
    };
    chiffres_affaires?: {
        part_ca_percent?: string;
        n?: {
            annee: string;
            debut?: string;
            fin?: string;
            ca_global: string;
        };
        n1?: {
            annee: string;
            debut?: string;
            fin?: string;
            ca_global: string;
        };
        n2?: {
            annee: string;
            debut?: string;
            fin?: string;
            ca_global: string;
        };
    };
    groupement?: {
        est_groupement: boolean;
        type?: 'conjoint' | 'solidaire' | null;
        membre_groupe?: {
            nom: string;
            adresse: string;
            adresse_siege?: string;
            email: string;
            telephone: string;
            siret: string;
        };
        mandataire?: {
            nom_commercial: string;
            adresse: string;
            email?: string;
            telephone?: string;
            siret?: string;
        };
        mandataire_solidaire?: boolean;
        membres?: Array<{
            nom: string;
            prestation: string;
            montant: string;
        }>;
    };
    signataire?: {
        nom: string;
        prenom: string;
        qualite: string;
        complet?: string;
    };
    checkboxes?: {
        candidat_seul?: boolean;
        groupement?: boolean;
        groupement_conjoint?: boolean;
        groupement_solidaire?: boolean;
        mandataire_solidaire_oui?: boolean;
        mandataire_solidaire_non?: boolean;
        mandat_signature?: boolean;
        mandat_modifications?: boolean;
        pme?: boolean;
        non_pme?: boolean;
    };
    date_signature?: string;
    lieu_signature?: string;
}
/**
 * Récupère une valeur imbriquée dans un objet via un chemin "a.b.c"
 */
export declare function getNestedValue(obj: Record<string, any>, path: string): any;
/**
 * Convertit les données JSON en un objet plat avec les tags standardisés
 */
export declare function mapDataToTags(data: Record<string, any>): Record<string, string>;
/**
 * Liste tous les tags disponibles par catégorie
 */
export declare function getAvailableTagsByCategory(): Record<string, string[]>;
