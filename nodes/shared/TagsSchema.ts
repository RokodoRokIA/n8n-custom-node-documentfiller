/**
 * Schéma de tags standardisé pour les marchés publics français
 *
 * Ce fichier définit tous les tags utilisables dans les templates DOCX
 * pour les formulaires DC1, DC2, AE (ATTRI1) et autres documents administratifs.
 *
 * Format des données JSON attendu: voir DATA_SCHEMA ci-dessous
 */

// ============================================================================
// TAGS STANDARDISÉS
// ============================================================================

export const TAGS = {
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
} as const;

// ============================================================================
// MAPPING TAGS → CHEMIN JSON
// ============================================================================

export const TAG_TO_PATH: Record<string, string> = {
	// Entreprise
	[TAGS.NOM_COMMERCIAL]: 'entreprise.nom_commercial',
	[TAGS.DENOMINATION]: 'entreprise.denomination_sociale',
	[TAGS.SIRET]: 'entreprise.siret',
	[TAGS.SIREN]: 'entreprise.siret', // Sera tronqué à 9 chiffres
	[TAGS.ADRESSE]: 'entreprise.adresse',
	[TAGS.ADRESSE_SIEGE]: 'entreprise.adresse_siege',
	[TAGS.EMAIL]: 'entreprise.email',
	[TAGS.EMAIL_CONTACT]: 'entreprise.email_contact',
	[TAGS.TELEPHONE]: 'entreprise.telephone',
	[TAGS.FAX]: 'entreprise.fax',
	[TAGS.FORME_JURIDIQUE]: 'entreprise.forme_juridique',
	[TAGS.SITE_WEB]: 'entreprise.site_web',

	// Registre
	[TAGS.INSCRIPTION_REGISTRE]: 'registre_professionnel.inscription',
	[TAGS.CERTIFICATIONS]: 'registre_professionnel.certifications',
	[TAGS.DESCRIPTION_PARTENARIAT]: 'registre_professionnel.description_partenariat',
	[TAGS.DESCRIPTION_ACTIVITE]: 'registre_professionnel.description_activite',

	// CA
	[TAGS.CA_N]: 'chiffres_affaires.n.ca_global',
	[TAGS.CA_N_ANNEE]: 'chiffres_affaires.n.annee',
	[TAGS.CA_N_DEBUT]: 'chiffres_affaires.n.debut',
	[TAGS.CA_N_FIN]: 'chiffres_affaires.n.fin',
	[TAGS.CA_N1]: 'chiffres_affaires.n1.ca_global',
	[TAGS.CA_N1_ANNEE]: 'chiffres_affaires.n1.annee',
	[TAGS.CA_N1_DEBUT]: 'chiffres_affaires.n1.debut',
	[TAGS.CA_N1_FIN]: 'chiffres_affaires.n1.fin',
	[TAGS.CA_N2]: 'chiffres_affaires.n2.ca_global',
	[TAGS.CA_N2_ANNEE]: 'chiffres_affaires.n2.annee',
	[TAGS.CA_N2_DEBUT]: 'chiffres_affaires.n2.debut',
	[TAGS.CA_N2_FIN]: 'chiffres_affaires.n2.fin',
	[TAGS.PART_CA]: 'chiffres_affaires.part_ca_percent',

	// Groupement
	[TAGS.MEMBRE_GROUPE_NOM]: 'groupement.membre_groupe.nom',
	[TAGS.MEMBRE_GROUPE_ADRESSE]: 'groupement.membre_groupe.adresse',
	[TAGS.MEMBRE_GROUPE_ADRESSE_SIEGE]: 'groupement.membre_groupe.adresse_siege',
	[TAGS.MEMBRE_GROUPE_EMAIL]: 'groupement.membre_groupe.email',
	[TAGS.MEMBRE_GROUPE_TELEPHONE]: 'groupement.membre_groupe.telephone',
	[TAGS.MEMBRE_GROUPE_SIRET]: 'groupement.membre_groupe.siret',
	[TAGS.MANDATAIRE_NOM]: 'groupement.mandataire.nom_commercial',
	[TAGS.MANDATAIRE_ADRESSE]: 'groupement.mandataire.adresse',
	[TAGS.MANDATAIRE_EMAIL]: 'groupement.mandataire.email',
	[TAGS.MANDATAIRE_TELEPHONE]: 'groupement.mandataire.telephone',
	[TAGS.MANDATAIRE_SIRET]: 'groupement.mandataire.siret',
	[TAGS.TYPE_GROUPEMENT]: 'groupement.type',

	// Signataire
	[TAGS.SIGNATAIRE_NOM]: 'signataire.nom',
	[TAGS.SIGNATAIRE_PRENOM]: 'signataire.prenom',
	[TAGS.SIGNATAIRE_QUALITE]: 'signataire.qualite',
	[TAGS.SIGNATAIRE_COMPLET]: 'signataire.complet',

	// Checkboxes
	[TAGS.CHECK_CANDIDAT_SEUL]: 'checkboxes.candidat_seul',
	[TAGS.CHECK_GROUPEMENT]: 'checkboxes.groupement',
	[TAGS.CHECK_GROUPEMENT_CONJOINT]: 'checkboxes.groupement_conjoint',
	[TAGS.CHECK_GROUPEMENT_SOLIDAIRE]: 'checkboxes.groupement_solidaire',
	[TAGS.CHECK_MANDATAIRE_SOLIDAIRE_OUI]: 'checkboxes.mandataire_solidaire_oui',
	[TAGS.CHECK_MANDATAIRE_SOLIDAIRE_NON]: 'checkboxes.mandataire_solidaire_non',
	[TAGS.CHECK_MANDAT_SIGNATURE]: 'checkboxes.mandat_signature',
	[TAGS.CHECK_MANDAT_MODIFICATIONS]: 'checkboxes.mandat_modifications',
	[TAGS.CHECK_PME]: 'checkboxes.pme',
	[TAGS.CHECK_NON_PME]: 'checkboxes.non_pme',

	// Date/Lieu
	[TAGS.DATE_SIGNATURE]: 'date_signature',
	[TAGS.LIEU_SIGNATURE]: 'lieu_signature',
};

// ============================================================================
// SCHÉMA DE DONNÉES JSON
// ============================================================================

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
		n?: { annee: string; debut?: string; fin?: string; ca_global: string };
		n1?: { annee: string; debut?: string; fin?: string; ca_global: string };
		n2?: { annee: string; debut?: string; fin?: string; ca_global: string };
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

// ============================================================================
// UTILITAIRES
// ============================================================================

/**
 * Récupère une valeur imbriquée dans un objet via un chemin "a.b.c"
 */
export function getNestedValue(obj: Record<string, any>, path: string): any {
	const parts = path.split('.');
	let current = obj;

	for (const part of parts) {
		if (current === null || current === undefined) return '';
		current = current[part];
	}

	return current ?? '';
}

/**
 * Convertit les données JSON en un objet plat avec les tags standardisés
 */
export function mapDataToTags(data: Record<string, any>): Record<string, string> {
	const result: Record<string, string> = {};

	for (const [tag, path] of Object.entries(TAG_TO_PATH)) {
		let value = getNestedValue(data, path);

		// Traitement spécial pour SIREN (9 premiers chiffres du SIRET)
		if (tag === TAGS.SIREN && typeof value === 'string') {
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
	if (data.groupement?.membres && Array.isArray(data.groupement.membres)) {
		(result as any).membres = data.groupement.membres.map(
			(m: any, idx: number) => ({
				MEMBRE_NUM: idx + 1,
				MEMBRE_NOM: m.nom || '',
				MEMBRE_PRESTATION: m.prestation || '',
				MEMBRE_MONTANT: m.montant || '',
			}),
		);
	}

	return result;
}

/**
 * Liste tous les tags disponibles par catégorie
 */
export function getAvailableTagsByCategory(): Record<string, string[]> {
	return {
		'Entreprise': [
			TAGS.NOM_COMMERCIAL,
			TAGS.DENOMINATION,
			TAGS.SIRET,
			TAGS.SIREN,
			TAGS.ADRESSE,
			TAGS.ADRESSE_SIEGE,
			TAGS.EMAIL,
			TAGS.EMAIL_CONTACT,
			TAGS.TELEPHONE,
			TAGS.FAX,
			TAGS.FORME_JURIDIQUE,
			TAGS.SITE_WEB,
		],
		'Registre Professionnel': [
			TAGS.INSCRIPTION_REGISTRE,
			TAGS.CERTIFICATIONS,
			TAGS.DESCRIPTION_PARTENARIAT,
			TAGS.DESCRIPTION_ACTIVITE,
		],
		'Chiffres d\'Affaires': [
			TAGS.CA_N,
			TAGS.CA_N_ANNEE,
			TAGS.CA_N1,
			TAGS.CA_N1_ANNEE,
			TAGS.CA_N2,
			TAGS.CA_N2_ANNEE,
			TAGS.PART_CA,
		],
		'Groupement - Membre': [
			TAGS.MEMBRE_GROUPE_NOM,
			TAGS.MEMBRE_GROUPE_ADRESSE,
			TAGS.MEMBRE_GROUPE_ADRESSE_SIEGE,
			TAGS.MEMBRE_GROUPE_EMAIL,
			TAGS.MEMBRE_GROUPE_TELEPHONE,
			TAGS.MEMBRE_GROUPE_SIRET,
		],
		'Groupement - Mandataire': [
			TAGS.MANDATAIRE_NOM,
			TAGS.MANDATAIRE_ADRESSE,
			TAGS.MANDATAIRE_EMAIL,
			TAGS.MANDATAIRE_TELEPHONE,
			TAGS.MANDATAIRE_SIRET,
			TAGS.TYPE_GROUPEMENT,
		],
		'Signataire': [
			TAGS.SIGNATAIRE_NOM,
			TAGS.SIGNATAIRE_PRENOM,
			TAGS.SIGNATAIRE_QUALITE,
			TAGS.SIGNATAIRE_COMPLET,
		],
		'Checkboxes': [
			TAGS.CHECK_CANDIDAT_SEUL,
			TAGS.CHECK_GROUPEMENT,
			TAGS.CHECK_GROUPEMENT_CONJOINT,
			TAGS.CHECK_GROUPEMENT_SOLIDAIRE,
			TAGS.CHECK_MANDATAIRE_SOLIDAIRE_OUI,
			TAGS.CHECK_MANDATAIRE_SOLIDAIRE_NON,
			TAGS.CHECK_PME,
			TAGS.CHECK_NON_PME,
		],
		'Date/Lieu': [TAGS.DATE_SIGNATURE, TAGS.LIEU_SIGNATURE],
	};
}
