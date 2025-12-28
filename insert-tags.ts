/**
 * Script d'insertion de tags {{TAG}} dans les documents DC1, DC2 et AE
 *
 * Optimisé pour cibler uniquement les sections pertinentes:
 * - DC1: Section D (Présentation du candidat)
 * - DC2: Section C (Identification du candidat) + Section E1 (Chiffres d'affaires)
 * - AE: Section B (Membre du groupement - table répétable)
 *
 * LOGIQUE DE DÉDUPLICATION:
 * -------------------------
 * Le script utilise un système de tracking pour éviter les doublons de tags:
 * 1. Chaque label n'est traité qu'UNE SEULE FOIS par document
 * 2. Un Set `processedLabels` garde trace des labels déjà utilisés
 * 3. Pour DC2/AE avec labels fragmentés, on utilise des fragments uniques
 * 4. La recherche se fait dans une section délimitée (start/end)
 *
 * Usage:
 *   npx ts-node insert-tags.ts dc1          # Insère tags dans DC1
 *   npx ts-node insert-tags.ts dc2          # Insère tags dans DC2
 *   npx ts-node insert-tags.ts ae           # Insère tags dans AE
 *   npx ts-node insert-tags.ts dc1 dc2 ae   # Tous les documents
 */

import * as fs from 'fs';
import * as path from 'path';
import PizZip from 'pizzip';

// ============================================================================
// CONFIGURATION DES TAGS
// ============================================================================

/**
 * Tags pour DC1 - Section D (Présentation du candidat)
 */
const DC1_SECTION_D_TAGS: Record<string, string> = {
	'Nom commercial et dénomination sociale': '{{NOM_COMMERCIAL}}\n{{DENOMINATION}}',
	'Adresses postale et du siège': '{{ADRESSE}}\n{{ADRESSE_SIEGE}}',
	'Adresse électronique': '{{EMAIL}}',
	'Numéros de téléphone et de télécopie': '{{TELEPHONE}}',
	'Numéro SIRET': '{{SIRET}}',
};

/**
 * Tags pour DC2 - Section C1 (Identification du candidat - Cas général)
 *
 * STRUCTURE DU DC2:
 * ├── C - Identification du candidat individuel ou du membre du groupement
 * │   ├── C1 - Cas général
 * │   │   ├── [Bloc descriptif - à ignorer]
 * │   │   ├── Nom commercial et dénomination sociale... : [CHAMP]
 * │   │   ├── Adresses postale et du siège social... : [CHAMP]
 * │   │   ├── Adresse électronique : [CHAMP]
 * │   │   ├── Numéros de téléphone et de télécopie : [CHAMP]
 * │   │   ├── Numéro SIRET... : [CHAMP]
 * │   │   ├── Forme juridique... : [CHAMP]
 * │   │   └── Question PME: Oui ☐ / Non ☐
 * │   └── C2 - Cas spécifiques relatifs aux conditions de participation
 *
 * STRATÉGIE: Les vrais labels sont suivis de " :" et ont un paragraphe vide après
 * On cherche la DEUXIÈME occurrence de chaque pattern (la première est dans le bloc descriptif)
 */
const DC2_SECTION_C1_TAGS: Array<{ label: string; tag: string; id: string; occurrence: number }> = [
	// Label 1: Nom commercial - 2ème occurrence (1ère = bloc descriptif)
	{ id: 'dc2_nom', label: 'Nom commercial', tag: '{{NOM_COMMERCIAL}}\n{{DENOMINATION}}', occurrence: 2 },
	// Label 2: Adresses - 1ère occurrence (pattern unique "dresses postale")
	{ id: 'dc2_adresse', label: 'dresses postale', tag: '{{ADRESSE}}\n{{ADRESSE_SIEGE}}', occurrence: 1 },
	// Label 3: Email - 2ème occurrence
	{ id: 'dc2_email', label: 'dresse électronique', tag: '{{EMAIL}}', occurrence: 2 },
	// Label 4: Téléphone - 2ème occurrence
	{ id: 'dc2_tel', label: 'de téléphone', tag: '{{TELEPHONE}}', occurrence: 2 },
	// Label 5: SIRET - 2ème occurrence
	{ id: 'dc2_siret', label: 'uméro SIRET', tag: '{{SIRET}}', occurrence: 2 },
	// Label 6: Forme juridique - 1ère occurrence (pas dans le bloc descriptif)
	{ id: 'dc2_forme', label: 'Forme juridique', tag: '{{FORME_JURIDIQUE}}', occurrence: 1 },
];

/**
 * Checkbox PME pour DC2 - Question "Le candidat est-il une micro, petite ou moyenne entreprise..."
 */
const DC2_CHECKBOX_PME = {
	questionLabel: 'est-il une micro',
	ouiTag: '{{CHECK_PME_OUI}}',
	nonTag: '{{CHECK_PME_NON}}',
};

/**
 * Tags pour DC2 - Section E1 (Chiffres d'affaires)
 * Table 4 colonnes x 3 lignes
 */
const DC2_TABLE_E1_TAGS = {
	// Row 0: Dates d'exercice (colonnes 1, 2, 3)
	exercice_n: '{{CA_N_DEBUT}} au {{CA_N_FIN}}',
	exercice_n1: '{{CA_N1_DEBUT}} au {{CA_N1_FIN}}',
	exercice_n2: '{{CA_N2_DEBUT}} au {{CA_N2_FIN}}',
	// Row 1: CA global (colonnes 1, 2, 3)
	ca_n: '{{CA_N}}',
	ca_n1: '{{CA_N1}}',
	ca_n2: '{{CA_N2}}',
	// Row 2: Part CA % (colonnes 1, 2, 3) - déjà avec %
	part_n: '{{PART_CA_N}}',
	part_n1: '{{PART_CA_N1}}',
	part_n2: '{{PART_CA_N2}}',
};

/**
 * Tags pour AE - Section B (Membre du groupement)
 *
 * SECTION CIBLE: "[Tableau à reproduire autant de fois qu'il y a de membres.]"
 * Suivi de "Membre du groupement" et une table avec les champs suivants
 *
 * Structure de la table membre (2 colonnes):
 * - Col 0: Label (Nom commercial, Adresse, etc.)
 * - Col 1: Valeur à remplir (vide -> tag)
 */
const AE_MEMBRE_TABLE_TAGS: Array<{ label: string; tag: string; id: string }> = [
	{ id: 'ae_nom', label: 'Nom commercial', tag: '{{MEMBRE_NOM_COMMERCIAL}}\n{{MEMBRE_DENOMINATION}}' },
	{ id: 'ae_adresse_etab', label: "Adresse de l'établissement", tag: '{{MEMBRE_ADRESSE}}' },
	{ id: 'ae_adresse_siege', label: 'Adresse du siège social', tag: '{{MEMBRE_ADRESSE_SIEGE}}' },
	{ id: 'ae_email', label: 'Adresse électronique', tag: '{{MEMBRE_EMAIL}}' },
	{ id: 'ae_tel', label: 'Téléphone', tag: '{{MEMBRE_TELEPHONE}}' },
	{ id: 'ae_siret', label: 'Numéro SIRET', tag: '{{MEMBRE_SIRET}}' },
];

// ============================================================================
// TYPES
// ============================================================================

interface InsertResult {
	filename: string;
	tagsInserted: string[];
	errors: string[];
	sectionsProcessed: string[];
}

interface SectionBounds {
	start: number;
	end: number;
	name: string;
}

/**
 * Context de traitement pour éviter les doublons
 * Garde trace des labels déjà traités dans le document
 */
interface ProcessingContext {
	/** Set des IDs de tags déjà insérés */
	processedIds: Set<string>;
	/** Position du dernier tag inséré (pour ajuster les recherches suivantes) */
	lastInsertPosition: number;
	/** Décalage cumulé après insertions */
	cumulativeOffset: number;
}

// ============================================================================
// FONCTIONS UTILITAIRES
// ============================================================================

/**
 * Échappe les caractères spéciaux XML
 */
function escapeXml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

/**
 * Convertit le texte (avec potentiels \n) en XML Word
 */
function textToWordXml(text: string, preserveStyle: string = ''): string {
	const lines = text.split('\n');

	if (lines.length === 1) {
		return `<w:r>${preserveStyle}<w:t>${escapeXml(text)}</w:t></w:r>`;
	}

	return lines
		.map((line, i) => {
			const escaped = escapeXml(line);
			const br = i < lines.length - 1 ? '<w:br/>' : '';
			return `<w:r>${preserveStyle}<w:t>${escaped}</w:t>${br}</w:r>`;
		})
		.join('');
}

/**
 * Trouve les limites d'une section dans le XML
 */
function findSectionBounds(xml: string, sectionMarker: string, nextSectionMarker?: string): SectionBounds | null {
	const start = xml.indexOf(sectionMarker);
	if (start < 0) return null;

	let end = xml.length;
	if (nextSectionMarker) {
		const nextStart = xml.indexOf(nextSectionMarker, start + sectionMarker.length);
		if (nextStart > start) end = nextStart;
	}

	return { start, end, name: sectionMarker.substring(0, 30) };
}

/**
 * Crée un nouveau contexte de traitement
 */
function createProcessingContext(): ProcessingContext {
	return {
		processedIds: new Set<string>(),
		lastInsertPosition: 0,
		cumulativeOffset: 0,
	};
}

/**
 * Trouve la N-ième occurrence d'un pattern dans une chaîne
 * @param str Chaîne à chercher
 * @param pattern Pattern à trouver
 * @param occurrence Numéro de l'occurrence (1 = première)
 * @returns Position de l'occurrence ou -1 si non trouvée
 */
function findNthOccurrence(str: string, pattern: string, occurrence: number): number {
	let pos = -1;
	let count = 0;

	while (count < occurrence) {
		pos = str.indexOf(pattern, pos + 1);
		if (pos < 0) return -1;
		count++;
	}

	return pos;
}

/**
 * Insère un tag après la N-ième occurrence d'un label
 * Utilisé pour DC2 où les labels apparaissent 2 fois (bloc descriptif + vrai label)
 */
function insertTagAfterNthLabel(
	xml: string,
	sectionStart: number,
	sectionEnd: number,
	label: string,
	tagValue: string,
	tagId: string,
	occurrence: number,
	context: ProcessingContext
): { xml: string; success: boolean; position: number } {
	// DÉDUPLICATION: Vérifier si ce tag a déjà été traité
	if (context.processedIds.has(tagId)) {
		console.log(`    [SKIP] Tag ${tagId} déjà inséré, ignoré`);
		return { xml, success: false, position: -1 };
	}

	// Chercher dans la section complète (pas d'offset car on cherche occurrence)
	const section = xml.substring(sectionStart, sectionEnd);

	// Trouver la N-ième occurrence du label
	const labelIdx = findNthOccurrence(section, label, occurrence);

	if (labelIdx < 0) {
		return { xml, success: false, position: -1 };
	}

	const absoluteLabelIdx = sectionStart + labelIdx;

	// Trouver le début et la fin du paragraphe contenant le label
	const pStart = xml.lastIndexOf('<w:p', absoluteLabelIdx);
	let pEnd = xml.indexOf('</w:p>', absoluteLabelIdx);
	if (pEnd < 0) return { xml, success: false, position: -1 };
	pEnd += 6;

	const labelParagraph = xml.substring(pStart, pEnd);
	const originalLength = xml.length;

	// Chercher le paragraphe vide suivant (dans les 4 prochains paragraphes)
	let searchPos = pEnd;
	for (let i = 0; i < 4; i++) {
		const nextPStart = xml.indexOf('<w:p', searchPos);
		const nextPEnd = xml.indexOf('</w:p>', nextPStart);

		if (nextPStart < 0 || nextPEnd < 0 || nextPStart >= sectionEnd) break;

		const paragraph = xml.substring(nextPStart, nextPEnd + 6);

		// Vérifier si le paragraphe est vide ou quasi-vide
		const texts = paragraph.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
		const content = texts.map(t => t.replace(/<[^>]+>/g, '')).join('').trim();

		if (!content || content.length < 3) {
			// Extraire le style du paragraphe
			const pPrMatch = paragraph.match(/<w:pPr>[\s\S]*?<\/w:pPr>/);
			const pPr = pPrMatch ? pPrMatch[0] : '';

			// Créer le nouveau paragraphe avec les tags
			const tagXml = textToWordXml(tagValue);
			const newParagraph = `<w:p>${pPr}${tagXml}</w:p>`;

			// Remplacer
			const newXml = xml.substring(0, nextPStart) + newParagraph + xml.substring(nextPEnd + 6);

			// DÉDUPLICATION: Marquer comme traité
			context.processedIds.add(tagId);
			context.cumulativeOffset += newXml.length - originalLength;

			return { xml: newXml, success: true, position: nextPStart };
		}

		searchPos = nextPEnd + 6;
	}

	// Fallback: insérer après le paragraphe du label
	const pPrMatch = labelParagraph.match(/<w:pPr>[\s\S]*?<\/w:pPr>/);
	const pPr = pPrMatch ? pPrMatch[0] : '';
	const tagXml = textToWordXml(tagValue);
	const newParagraph = `<w:p>${pPr}${tagXml}</w:p>`;

	const newXml = xml.substring(0, pEnd) + newParagraph + xml.substring(pEnd);

	context.processedIds.add(tagId);
	context.cumulativeOffset += newXml.length - originalLength;

	return { xml: newXml, success: true, position: pEnd };
}

/**
 * Insère un tag à côté d'une checkbox (Oui/Non)
 */
function insertCheckboxTags(
	xml: string,
	sectionStart: number,
	sectionEnd: number,
	questionLabel: string,
	ouiTag: string,
	nonTag: string,
	context: ProcessingContext
): { xml: string; success: boolean } {
	const section = xml.substring(sectionStart, sectionEnd);

	// Trouver la question
	const questionIdx = section.indexOf(questionLabel);
	if (questionIdx < 0) {
		return { xml, success: false };
	}

	const absoluteQuestionIdx = sectionStart + questionIdx;

	// Trouver "Oui" après la question
	const ouiIdx = xml.indexOf('Oui', absoluteQuestionIdx);
	if (ouiIdx < 0 || ouiIdx > sectionEnd) {
		return { xml, success: false };
	}

	// Trouver "Non" après "Oui"
	const nonIdx = xml.indexOf('Non', ouiIdx);
	if (nonIdx < 0 || nonIdx > sectionEnd) {
		return { xml, success: false };
	}

	let currentXml = xml;

	// Insérer le tag après "Oui"
	const ouiEndTag = currentXml.indexOf('</w:t>', ouiIdx);
	if (ouiEndTag > 0) {
		const insertPos = ouiEndTag + 6;
		const ouiTagXml = `<w:r><w:t> ${ouiTag}</w:t></w:r>`;
		currentXml = currentXml.substring(0, insertPos) + ouiTagXml + currentXml.substring(insertPos);

		// Ajuster la position de "Non" après l'insertion
		const newNonIdx = currentXml.indexOf('Non', ouiIdx + ouiTagXml.length);
		if (newNonIdx > 0) {
			const nonEndTag = currentXml.indexOf('</w:t>', newNonIdx);
			if (nonEndTag > 0) {
				const nonInsertPos = nonEndTag + 6;
				const nonTagXml = `<w:r><w:t> ${nonTag}</w:t></w:r>`;
				currentXml = currentXml.substring(0, nonInsertPos) + nonTagXml + currentXml.substring(nonInsertPos);
			}
		}

		context.processedIds.add('dc2_pme_checkbox');
		return { xml: currentXml, success: true };
	}

	return { xml, success: false };
}

/**
 * Trouve et remplace le contenu d'un paragraphe vide après un label
 * Mode 'replace': remplace un paragraphe vide existant
 * Mode 'insert': insère un nouveau paragraphe après le label (si pas de paragraphe vide)
 *
 * DÉDUPLICATION:
 * - Utilise un ID unique pour chaque tag
 * - Vérifie dans le contexte si l'ID a déjà été traité
 * - Met à jour le contexte après insertion réussie
 *
 * @param xml Document XML
 * @param sectionStart Position de début de la section
 * @param sectionEnd Position de fin de la section
 * @param label Texte du label à rechercher
 * @param tagValue Valeur du tag à insérer
 * @param tagId ID unique du tag (pour déduplication)
 * @param context Contexte de traitement partagé
 * @param mode Mode d'insertion ('replace' ou 'insert')
 */
function insertTagAfterLabel(
	xml: string,
	sectionStart: number,
	sectionEnd: number,
	label: string,
	tagValue: string,
	tagId: string,
	context: ProcessingContext,
	mode: 'replace' | 'insert' = 'replace'
): { xml: string; success: boolean; position: number } {
	// DÉDUPLICATION: Vérifier si ce tag a déjà été traité
	if (context.processedIds.has(tagId)) {
		console.log(`    [SKIP] Tag ${tagId} déjà inséré, ignoré`);
		return { xml, success: false, position: -1 };
	}

	// Ajuster les positions avec le décalage cumulé
	const adjustedStart = sectionStart + context.cumulativeOffset;
	const adjustedEnd = sectionEnd + context.cumulativeOffset;

	// Chercher le label dans la section ajustée
	const section = xml.substring(adjustedStart, adjustedEnd);
	const labelIdx = section.indexOf(label);

	if (labelIdx < 0) {
		return { xml, success: false, position: -1 };
	}

	const absoluteLabelIdx = adjustedStart + labelIdx;

	// Trouver le début et la fin du paragraphe contenant le label
	const pStart = xml.lastIndexOf('<w:p', absoluteLabelIdx);
	let pEnd = xml.indexOf('</w:p>', absoluteLabelIdx);
	if (pEnd < 0) return { xml, success: false, position: -1 };
	pEnd += 6;

	const labelParagraph = xml.substring(pStart, pEnd);
	const originalLength = xml.length;

	// Chercher le paragraphe vide suivant (dans les 4 prochains paragraphes)
	let searchPos = pEnd;
	for (let i = 0; i < 4; i++) {
		const nextPStart = xml.indexOf('<w:p', searchPos);
		const nextPEnd = xml.indexOf('</w:p>', nextPStart);

		if (nextPStart < 0 || nextPEnd < 0 || nextPStart >= adjustedEnd) break;

		const paragraph = xml.substring(nextPStart, nextPEnd + 6);

		// Vérifier si le paragraphe est vide
		const texts = paragraph.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
		const content = texts.map(t => t.replace(/<[^>]+>/g, '')).join('').trim();

		if (!content) {
			// Extraire le style du paragraphe
			const pPrMatch = paragraph.match(/<w:pPr>[\s\S]*?<\/w:pPr>/);
			const pPr = pPrMatch ? pPrMatch[0] : '';

			// Créer le nouveau paragraphe avec les tags
			const tagXml = textToWordXml(tagValue);
			const newParagraph = `<w:p>${pPr}${tagXml}</w:p>`;

			// Remplacer
			const newXml = xml.substring(0, nextPStart) + newParagraph + xml.substring(nextPEnd + 6);

			// DÉDUPLICATION: Marquer comme traité
			context.processedIds.add(tagId);
			context.lastInsertPosition = nextPStart;
			context.cumulativeOffset += newXml.length - originalLength;

			return { xml: newXml, success: true, position: nextPStart };
		}

		searchPos = nextPEnd + 6;
	}

	// Si mode 'insert' et pas de paragraphe vide trouvé, insérer après le label
	if (mode === 'insert') {
		// Extraire le style du paragraphe label pour le réutiliser
		const pPrMatch = labelParagraph.match(/<w:pPr>[\s\S]*?<\/w:pPr>/);
		const pPr = pPrMatch ? pPrMatch[0] : '';

		// Créer un nouveau paragraphe avec les tags
		const tagXml = textToWordXml(tagValue);
		const newParagraph = `<w:p>${pPr}${tagXml}</w:p>`;

		// Insérer juste après le paragraphe du label
		const newXml = xml.substring(0, pEnd) + newParagraph + xml.substring(pEnd);

		// DÉDUPLICATION: Marquer comme traité
		context.processedIds.add(tagId);
		context.lastInsertPosition = pEnd;
		context.cumulativeOffset += newXml.length - originalLength;

		return { xml: newXml, success: true, position: pEnd };
	}

	return { xml, success: false, position: -1 };
}

/**
 * Insère des tags dans les cellules d'une table
 */
function insertTagsInTable(
	xml: string,
	tableIndex: number,
	cellTags: Map<number, string>
): { xml: string; success: boolean; count: number } {
	const tables = xml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/g);
	if (!tables || tableIndex >= tables.length) {
		return { xml, success: false, count: 0 };
	}

	const table = tables[tableIndex];
	const tableStart = xml.indexOf(table);
	let newTable = table;
	let count = 0;

	// Extraire toutes les cellules
	const cells = table.match(/<w:tc>[\s\S]*?<\/w:tc>/g) || [];

	// Créer un mapping des remplacements
	const replacements: { original: string; replacement: string }[] = [];

	cellTags.forEach((tagValue, cellIndex) => {
		if (cellIndex >= cells.length) return;

		const cell = cells[cellIndex];

		// Trouver le premier paragraphe de la cellule
		const pMatch = cell.match(/<w:p[^>]*>[\s\S]*?<\/w:p>/);
		if (!pMatch) return;

		const originalP = pMatch[0];

		// Extraire les propriétés du paragraphe et du run
		const pPrMatch = originalP.match(/<w:pPr>[\s\S]*?<\/w:pPr>/);
		const rPrMatch = originalP.match(/<w:rPr>[\s\S]*?<\/w:rPr>/);
		const pPr = pPrMatch ? pPrMatch[0] : '';
		const rPr = rPrMatch ? rPrMatch[0] : '';

		// Créer le nouveau paragraphe avec le tag
		const tagXml = `<w:r>${rPr}<w:t>${escapeXml(tagValue)}</w:t></w:r>`;
		const newP = `<w:p>${pPr}${tagXml}</w:p>`;

		// Remplacer le paragraphe dans la cellule
		const newCell = cell.replace(originalP, newP);
		replacements.push({ original: cell, replacement: newCell });
		count++;
	});

	// Appliquer les remplacements
	replacements.forEach(r => {
		newTable = newTable.replace(r.original, r.replacement);
	});

	const newXml = xml.substring(0, tableStart) + newTable + xml.substring(tableStart + table.length);
	return { xml: newXml, success: count > 0, count };
}

// ============================================================================
// PROCESSEURS DE DOCUMENTS
// ============================================================================

/**
 * Traite DC1 - Insère les tags dans la Section D
 *
 * LOGIQUE:
 * 1. Trouve la Section D (entre "D - Présentation" et "E - ")
 * 2. Pour chaque label défini dans DC1_SECTION_D_TAGS:
 *    - Recherche le label dans la section
 *    - Trouve le paragraphe vide suivant (ou insère un nouveau)
 *    - Insère le tag correspondant
 * 3. Utilise le système de déduplication via ProcessingContext
 */
function processDC1(xml: string): { xml: string; result: InsertResult } {
	const result: InsertResult = {
		filename: 'DC1',
		tagsInserted: [],
		errors: [],
		sectionsProcessed: [],
	};

	console.log('\n=== DC1 - Insertion tags Section D ===\n');

	// Trouver les limites de la Section D
	const sectionD = findSectionBounds(xml, 'D - Présentation', 'E - ');

	if (!sectionD) {
		result.errors.push('Section D non trouvée');
		console.log('  [ERR] Section D non trouvée');
		return { xml, result };
	}

	console.log(`  Section D: positions ${sectionD.start} - ${sectionD.end}`);
	result.sectionsProcessed.push('Section D');

	let currentXml = xml;
	const context = createProcessingContext();

	// Insérer les tags pour chaque champ
	let tagIndex = 0;
	for (const [label, tagValue] of Object.entries(DC1_SECTION_D_TAGS)) {
		const tagId = `dc1_${tagIndex++}`;
		const { xml: newXml, success } = insertTagAfterLabel(
			currentXml,
			sectionD.start,
			sectionD.end,
			label,
			tagValue,
			tagId,
			context
		);

		if (success) {
			currentXml = newXml;
			result.tagsInserted.push(tagValue.replace(/\n/g, ', '));
			console.log(`  [OK] ${label.substring(0, 35)}: ${tagValue.replace(/\n/g, ' | ')}`);
		} else {
			result.errors.push(`Label non trouvé: ${label}`);
			console.log(`  [ERR] ${label.substring(0, 35)}: label non trouvé`);
		}
	}

	return { xml: currentXml, result };
}

/**
 * Traite DC2 - Insère les tags dans les Sections C1 et E1
 *
 * LOGIQUE:
 * 1. Section C1 (Identification du candidat - Cas général):
 *    - Trouve la section entre "C1 - Cas général" et "C2 - Cas spécifiques"
 *    - Pour chaque label: cherche la N-ième occurrence (évite le bloc descriptif)
 *    - Ajoute les tags dans les paragraphes vides après chaque label
 *    - Traite la checkbox PME (Oui/Non)
 *
 * 2. Section E1 (Table des chiffres d'affaires):
 *    - Trouve la table avec les exercices N, N-1, N-2
 *    - Insère les tags dans les cellules appropriées
 *
 * DÉDUPLICATION:
 * - Chaque tag a un ID unique + numéro d'occurrence
 * - Le contexte empêche l'insertion multiple du même tag
 */
function processDC2(xml: string): { xml: string; result: InsertResult } {
	const result: InsertResult = {
		filename: 'DC2',
		tagsInserted: [],
		errors: [],
		sectionsProcessed: [],
	};

	console.log('\n=== DC2 - Insertion tags Sections C1 et E1 ===\n');

	let currentXml = xml;
	const context = createProcessingContext();

	// ─────────────────────────────────────────────────────────────────────────
	// Section C1 - Identification du candidat (Cas général)
	// Délimitée entre "C1 - Cas général" et "C2 - Cas spécifiques"
	// ─────────────────────────────────────────────────────────────────────────

	const sectionC1 = findSectionBounds(currentXml, 'C1 - Cas général', 'C2');

	if (sectionC1) {
		console.log(`  Section C1: positions ${sectionC1.start} - ${sectionC1.end}`);
		result.sectionsProcessed.push('Section C1');

		// Traiter chaque label avec son numéro d'occurrence
		// La 2ème occurrence évite le bloc descriptif initial
		for (const fieldConfig of DC2_SECTION_C1_TAGS) {
			const { xml: newXml, success } = insertTagAfterNthLabel(
				currentXml,
				sectionC1.start,
				sectionC1.end + 5000, // Marge pour les insertions
				fieldConfig.label,
				fieldConfig.tag,
				fieldConfig.id,
				fieldConfig.occurrence,
				context
			);

			if (success) {
				currentXml = newXml;
				result.tagsInserted.push(fieldConfig.tag.replace(/\n/g, ', '));
				console.log(`  [OK] ${fieldConfig.label.substring(0, 30)} (occ.${fieldConfig.occurrence}): ${fieldConfig.tag.replace(/\n/g, ' | ')}`);
			} else if (!context.processedIds.has(fieldConfig.id)) {
				console.log(`  [SKIP] ${fieldConfig.label.substring(0, 30)}: occurrence ${fieldConfig.occurrence} non trouvée`);
			}
		}

		// ─────────────────────────────────────────────────────────────────────
		// Checkbox PME (Oui/Non)
		// ─────────────────────────────────────────────────────────────────────
		console.log('\n  --- Checkbox PME ---');

		const { xml: xmlWithCheckbox, success: checkboxSuccess } = insertCheckboxTags(
			currentXml,
			sectionC1.start,
			sectionC1.end + 10000,
			DC2_CHECKBOX_PME.questionLabel,
			DC2_CHECKBOX_PME.ouiTag,
			DC2_CHECKBOX_PME.nonTag,
			context
		);

		if (checkboxSuccess) {
			currentXml = xmlWithCheckbox;
			result.tagsInserted.push(`${DC2_CHECKBOX_PME.ouiTag}, ${DC2_CHECKBOX_PME.nonTag}`);
			console.log(`  [OK] Checkbox PME: ${DC2_CHECKBOX_PME.ouiTag} / ${DC2_CHECKBOX_PME.nonTag}`);
		} else {
			console.log(`  [SKIP] Checkbox PME: non trouvée`);
		}

	} else {
		result.errors.push('Section C1 non trouvée');
		console.log('  [ERR] Section C1 non trouvée');
	}

	// ─────────────────────────────────────────────────────────────────────────
	// Section E1 - Table des chiffres d'affaires
	// ─────────────────────────────────────────────────────────────────────────

	console.log('\n  --- Table E1 (Chiffres d\'affaires) ---');

	// La table E1 est la table 7 (index depuis 0)
	// Structure: 12 cellules = 4 colonnes x 3 lignes
	// Colonnes: [Label, Exercice N, Exercice N-1, Exercice N-2]
	// Lignes: [Dates, CA Global, Part CA %]

	const tableCellTags = new Map<number, string>([
		// Row 0: Dates d'exercice (cellules 1, 2, 3)
		[1, DC2_TABLE_E1_TAGS.exercice_n],
		[2, DC2_TABLE_E1_TAGS.exercice_n1],
		[3, DC2_TABLE_E1_TAGS.exercice_n2],
		// Row 1: CA global (cellules 5, 6, 7)
		[5, DC2_TABLE_E1_TAGS.ca_n],
		[6, DC2_TABLE_E1_TAGS.ca_n1],
		[7, DC2_TABLE_E1_TAGS.ca_n2],
		// Row 2: Part CA % (cellules 9, 10, 11)
		[9, DC2_TABLE_E1_TAGS.part_n],
		[10, DC2_TABLE_E1_TAGS.part_n1],
		[11, DC2_TABLE_E1_TAGS.part_n2],
	]);

	const { xml: xmlWithTable, success, count } = insertTagsInTable(currentXml, 7, tableCellTags);

	if (success) {
		currentXml = xmlWithTable;
		result.sectionsProcessed.push('Table E1');
		result.tagsInserted.push(`Table E1: ${count} cellules`);
		console.log(`  [OK] Table E1: ${count} cellules tagguées`);

		// Lister les tags insérés
		tableCellTags.forEach((tag, cell) => {
			console.log(`       Cell ${cell}: ${tag}`);
		});
	} else {
		result.errors.push('Table E1 non trouvée ou erreur');
		console.log('  [ERR] Table E1: impossible d\'insérer les tags');
	}

	return { xml: currentXml, result };
}

/**
 * Traite AE (Acte d'Engagement) - Insère les tags dans la section Membre du groupement
 *
 * LOGIQUE:
 * 1. Recherche de la section cible:
 *    - Marqueur: "[Tableau à reproduire autant de fois qu'il y a de membres.]"
 *    - Suivi de: "Membre du groupement"
 *
 * 2. Table membre du groupement (2 colonnes):
 *    - Colonne 0: Labels (Nom commercial, Adresse, etc.)
 *    - Colonne 1: Valeurs à remplir (vide -> tag)
 *
 * 3. Pour chaque ligne de la table:
 *    - Trouve le label dans la cellule 0
 *    - Insère le tag correspondant dans la cellule 1
 *
 * DÉDUPLICATION:
 * - Chaque tag a un ID unique (ae_nom, ae_adresse, etc.)
 * - Le contexte empêche l'insertion multiple du même tag
 */
function processAE(xml: string): { xml: string; result: InsertResult } {
	const result: InsertResult = {
		filename: 'AE',
		tagsInserted: [],
		errors: [],
		sectionsProcessed: [],
	};

	console.log('\n=== AE - Insertion tags Section Membre du groupement ===\n');

	let currentXml = xml;
	const context = createProcessingContext();

	// ─────────────────────────────────────────────────────────────────────────
	// Recherche de la section "Tableau à reproduire autant de fois qu'il y a de membres"
	// ─────────────────────────────────────────────────────────────────────────

	const sectionMarker = 'Tableau à reproduire autant de fois';
	const sectionStart = xml.indexOf(sectionMarker);

	if (sectionStart < 0) {
		result.errors.push('Section "Tableau à reproduire..." non trouvée');
		console.log('  [ERR] Section membre du groupement non trouvée');
		return { xml, result };
	}

	// Trouver "Membre du groupement" après le marqueur
	const membreMarker = 'Membre du groupement';
	const membreStart = xml.indexOf(membreMarker, sectionStart);

	if (membreStart < 0) {
		result.errors.push('Marqueur "Membre du groupement" non trouvé');
		console.log('  [ERR] Marqueur "Membre du groupement" non trouvé');
		return { xml, result };
	}

	// Trouver la table après "Membre du groupement"
	const tableStart = xml.indexOf('<w:tbl>', membreStart);
	const tableEnd = xml.indexOf('</w:tbl>', tableStart);

	if (tableStart < 0 || tableEnd < 0) {
		result.errors.push('Table membre du groupement non trouvée');
		console.log('  [ERR] Table membre du groupement non trouvée');
		return { xml, result };
	}

	console.log(`  Section membre: positions ${sectionStart} - ${tableEnd}`);
	console.log(`  Table membre: positions ${tableStart} - ${tableEnd}`);
	result.sectionsProcessed.push('Section Membre du groupement');

	// ─────────────────────────────────────────────────────────────────────────
	// Extraction et traitement de la table
	// ─────────────────────────────────────────────────────────────────────────

	const table = xml.substring(tableStart, tableEnd + 8);
	let newTable = table;

	// Extraire toutes les lignes de la table
	const rows = table.match(/<w:tr>[\s\S]*?<\/w:tr>/g) || [];
	console.log(`  Nombre de lignes dans la table: ${rows.length}`);

	// Pour chaque configuration de tag, trouver la ligne correspondante
	for (const tagConfig of AE_MEMBRE_TABLE_TAGS) {
		// Vérifier la déduplication
		if (context.processedIds.has(tagConfig.id)) {
			console.log(`    [SKIP] Tag ${tagConfig.id} déjà inséré`);
			continue;
		}

		// Trouver la ligne contenant ce label
		let rowIndex = -1;
		for (let i = 0; i < rows.length; i++) {
			if (rows[i].includes(tagConfig.label)) {
				rowIndex = i;
				break;
			}
		}

		if (rowIndex < 0) {
			console.log(`  [SKIP] Label "${tagConfig.label.substring(0, 25)}" non trouvé dans la table`);
			continue;
		}

		const row = rows[rowIndex];

		// Extraire les cellules de la ligne
		const cells = row.match(/<w:tc>[\s\S]*?<\/w:tc>/g) || [];
		if (cells.length < 2) {
			console.log(`  [ERR] Ligne ${rowIndex}: pas assez de cellules`);
			continue;
		}

		// La cellule 1 (index 1) contient la valeur à remplir
		const valueCell = cells[1];

		// Trouver le premier paragraphe de la cellule
		const pMatch = valueCell.match(/<w:p[^>]*>[\s\S]*?<\/w:p>/);
		if (!pMatch) {
			console.log(`  [ERR] Ligne ${rowIndex}: pas de paragraphe dans la cellule valeur`);
			continue;
		}

		const originalP = pMatch[0];

		// Extraire les propriétés du paragraphe et du run
		const pPrMatch = originalP.match(/<w:pPr>[\s\S]*?<\/w:pPr>/);
		const rPrMatch = originalP.match(/<w:rPr>[\s\S]*?<\/w:rPr>/);
		const pPr = pPrMatch ? pPrMatch[0] : '';
		const rPr = rPrMatch ? rPrMatch[0] : '';

		// Créer le nouveau paragraphe avec le tag
		const tagXml = textToWordXml(tagConfig.tag, rPr);
		const newP = `<w:p>${pPr}${tagXml}</w:p>`;

		// Créer la nouvelle cellule
		const newCell = valueCell.replace(originalP, newP);

		// Créer la nouvelle ligne
		const newRow = row.replace(valueCell, newCell);

		// Remplacer dans la table
		newTable = newTable.replace(row, newRow);

		// Marquer comme traité
		context.processedIds.add(tagConfig.id);
		result.tagsInserted.push(tagConfig.tag.replace(/\n/g, ', '));
		console.log(`  [OK] ${tagConfig.label.substring(0, 30)}: ${tagConfig.tag.replace(/\n/g, ' | ')}`);
	}

	// Remplacer la table dans le XML
	currentXml = xml.substring(0, tableStart) + newTable + xml.substring(tableEnd + 8);

	console.log(`\n  Résumé: ${result.tagsInserted.length} tags insérés`);

	return { xml: currentXml, result };
}

// ============================================================================
// FONCTION PRINCIPALE EXPORTÉE
// ============================================================================

/**
 * Types de documents supportés
 */
export type DocumentType = 'dc1' | 'dc2' | 'ae';

/**
 * Insère les tags dans un document DOCX
 *
 * @param docxBuffer Buffer du document DOCX
 * @param documentType Type de document: 'dc1', 'dc2' ou 'ae'
 * @returns Buffer modifié et résultat de l'opération
 *
 * Comportement selon le type:
 * - dc1: Traite la Section D (Présentation du candidat)
 * - dc2: Traite la Section C (Identification) et Table E1 (CA)
 * - ae: Traite la section Membre du groupement (table répétable)
 */
export async function insertTags(
	docxBuffer: Buffer,
	documentType: DocumentType
): Promise<{ buffer: Buffer; result: InsertResult }> {
	const zip = new PizZip(docxBuffer);
	let xml = zip.file('word/document.xml')?.asText() || '';

	let result: InsertResult;

	switch (documentType) {
		case 'dc1':
			const dc1Result = processDC1(xml);
			xml = dc1Result.xml;
			result = dc1Result.result;
			break;

		case 'dc2':
			const dc2Result = processDC2(xml);
			xml = dc2Result.xml;
			result = dc2Result.result;
			break;

		case 'ae':
			const aeResult = processAE(xml);
			xml = aeResult.xml;
			result = aeResult.result;
			break;

		default:
			throw new Error(`Type de document non supporté: ${documentType}`);
	}

	zip.file('word/document.xml', xml);

	const outputBuffer = zip.generate({
		type: 'nodebuffer',
		compression: 'DEFLATE',
	});

	return { buffer: Buffer.from(outputBuffer), result };
}

// ============================================================================
// CLI
// ============================================================================

/**
 * Configuration des fichiers par type de document
 */
const FILE_CONFIG: Record<DocumentType, { input: string; output: string }> = {
	dc1: {
		input: '25_NOMOS_DC1.docx',
		output: 'DC1_with_tags.docx',
	},
	dc2: {
		input: '25_NOMOS_DC2.docx',
		output: 'DC2_with_tags.docx',
	},
	ae: {
		input: 'AE_REMPLI.docx',
		output: 'AE_with_tags.docx',
	},
};

async function main() {
	const args = process.argv.slice(2);

	if (args.length === 0) {
		console.log('Usage: npx ts-node insert-tags.ts [dc1] [dc2] [ae]');
		console.log('');
		console.log('Documents supportés:');
		console.log('  dc1 - Insère tags dans 25_NOMOS_DC1.docx → DC1_with_tags.docx');
		console.log('        Section D: Présentation du candidat');
		console.log('');
		console.log('  dc2 - Insère tags dans 25_NOMOS_DC2.docx → DC2_with_tags.docx');
		console.log('        Section C: Identification du candidat');
		console.log('        Table E1: Chiffres d\'affaires');
		console.log('');
		console.log('  ae  - Insère tags dans AE_REMPLI.docx → AE_with_tags.docx');
		console.log('        Section B: Membre du groupement (table répétable)');
		console.log('        Cible: "[Tableau à reproduire autant de fois...]"');
		console.log('');
		console.log('Exemples:');
		console.log('  npx ts-node insert-tags.ts dc1');
		console.log('  npx ts-node insert-tags.ts dc1 dc2 ae');
		process.exit(0);
	}

	const documents = args.map(a => a.toLowerCase());

	console.log('╔═══════════════════════════════════════════════════════════╗');
	console.log('║   INSERTION DE TAGS {{TAG}} DANS DOCUMENTS DOCX           ║');
	console.log('║   Avec déduplication automatique par ID unique            ║');
	console.log('╚═══════════════════════════════════════════════════════════╝');

	for (const doc of documents) {
		if (!['dc1', 'dc2', 'ae'].includes(doc)) {
			console.log(`\n[SKIP] Document inconnu: ${doc}`);
			console.log('       Types supportés: dc1, dc2, ae');
			continue;
		}

		const docType = doc as DocumentType;
		const config = FILE_CONFIG[docType];

		const inputPath = path.join(__dirname, config.input);
		const outputPath = path.join(__dirname, config.output);

		if (!fs.existsSync(inputPath)) {
			console.log(`\n[ERR] Fichier non trouvé: ${inputPath}`);
			continue;
		}

		console.log(`\n━━━ ${doc.toUpperCase()} ━━━`);
		console.log(`Source: ${config.input}`);

		const inputBuffer = fs.readFileSync(inputPath);

		try {
			const { buffer, result } = await insertTags(inputBuffer, docType);

			fs.writeFileSync(outputPath, buffer);

			console.log(`\n  Résumé:`);
			console.log(`    Sections traitées: ${result.sectionsProcessed.join(', ')}`);
			console.log(`    Tags insérés: ${result.tagsInserted.length}`);
			if (result.errors.length > 0) {
				console.log(`    Erreurs: ${result.errors.length}`);
				result.errors.forEach(e => console.log(`      - ${e}`));
			}
			console.log(`  Fichier généré: ${config.output}`);

		} catch (error) {
			console.error(`\n  [ERREUR] ${error}`);
		}
	}

	console.log('\n═══════════════════════════════════════════════════════════');
	console.log('Terminé. Ouvrez les fichiers *_with_tags.docx pour vérifier.');
}

main();
