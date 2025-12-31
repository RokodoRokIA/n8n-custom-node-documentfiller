/**
 * ============================================================================
 * SERVICE TAG APPLICATOR - Application des tags dans le document
 * ============================================================================
 *
 * Ce service gère l'insertion physique des tags {{TAG}} dans le document XML.
 * Il prend les résultats du matching IA et modifie le XML en conséquence.
 *
 * TYPES D'INSERTION SUPPORTÉS :
 * - after_colon   : Après un deux-points (Nom : → Nom : {{NOM}})
 * - replace_empty : Remplace une cellule vide
 * - inline        : Dans le texte existant
 * - checkbox      : Pour les cases à cocher
 * - table_cell    : Cellule de tableau (logique spéciale)
 *
 * POUR LES DÉVELOPPEURS JUNIORS :
 * - Le XML Word a une structure complexe avec des "runs" (<w:r>)
 * - Chaque run contient du texte (<w:t>) avec un formatage uniforme
 * - On doit modifier le XML tout en préservant la structure
 *
 * @author Rokodo
 * @version 2.0.0
 */

import { MatchResult, TargetParagraph, TagApplicationResult } from '../../shared/types';
import { extractTextFromXml } from '../../shared/utils';

// ============================================================================
// APPLICATION DES TAGS
// ============================================================================

/**
 * Applique les tags dans le document XML cible.
 *
 * Cette fonction prend les résultats du matching IA et insère chaque tag
 * dans le paragraphe correspondant du document XML.
 *
 * LOGIQUE IMPORTANTE :
 * - Les matches sont triés par index décroissant pour éviter les problèmes de décalage
 * - Chaque tag ne peut être utilisé qu'une seule fois
 * - Chaque paragraphe ne peut être modifié qu'une seule fois
 *
 * @param xml - Le XML du document cible
 * @param matches - Les résultats du matching IA
 * @param targetParagraphs - Les paragraphes extraits du document
 * @returns Le XML modifié et les statistiques d'application
 *
 * @example
 * const { xml, applied, failed } = applyTagsToTarget(documentXml, matches, paragraphs);
 * console.log(`${applied.length} tags appliqués, ${failed.length} échecs`);
 */
export function applyTagsToTarget(
	xml: string,
	matches: MatchResult[],
	targetParagraphs: TargetParagraph[]
): TagApplicationResult {
	let modifiedXml = xml;
	const applied: string[] = [];
	const failed: string[] = [];

	// Suivi des tags et paragraphes déjà utilisés
	const usedTags = new Set<string>();
	const modifiedParagraphs = new Map<number, string[]>(); // index → liste des tags déjà insérés

	// === PROTECTION ANTI-DOUBLONS: Détecter les tags déjà présents dans le document ===
	const existingTagsRegex = /\{\{([A-Z_0-9]+)\}\}/g;
	let existingMatch;
	while ((existingMatch = existingTagsRegex.exec(xml)) !== null) {
		usedTags.add(existingMatch[1]); // Marquer comme déjà utilisé
	}

	// === PRÉTRAITEMENT: Regrouper les tags DEBUT/FIN pour les dates d'exercice ===
	// Ces tags doivent être insérés ensemble dans le pattern "du {{DEBUT}} au {{FIN}}"
	const dateTagPairs = groupDateTagPairs(matches);

	// Traiter d'abord les paires de dates
	for (const pair of dateTagPairs) {
		const targetParagraph = targetParagraphs[pair.paragraphIndex];
		if (!targetParagraph) continue;

		const paragraphXml = modifiedXml.substring(
			targetParagraph.xmlStart,
			targetParagraph.xmlEnd
		);

		const result = insertDatePairInExerciseLine(
			paragraphXml,
			pair.debutTag,
			pair.finTag
		);

		if (result.success) {
			modifiedXml =
				modifiedXml.substring(0, targetParagraph.xmlStart) +
				result.newXml +
				modifiedXml.substring(targetParagraph.xmlEnd);

			const delta = result.newXml.length - paragraphXml.length;
			updateParagraphPositions(targetParagraphs, pair.paragraphIndex, delta);

			applied.push(`${pair.debutTag} → paragraphe ${pair.paragraphIndex} (date_debut)`);
			applied.push(`${pair.finTag} → paragraphe ${pair.paragraphIndex} (date_fin)`);
			usedTags.add(pair.debutTag);
			usedTags.add(pair.finTag);
			modifiedParagraphs.set(pair.paragraphIndex, [pair.debutTag, pair.finTag]);
		}
	}

	// IMPORTANT: Trier par index décroissant pour éviter les décalages de position
	// Si on modifie le paragraphe 10 avant le 5, les positions du 5 ne changent pas
	const sortedMatches = [...matches].sort(
		(a, b) => b.targetParagraphIndex - a.targetParagraphIndex
	);

	for (const match of sortedMatches) {
		// Vérification 1: Tag déjà utilisé ?
		if (usedTags.has(match.tag)) {
			// Silencieux pour les tags de dates déjà traités
			if (!match.tag.match(/_(DEBUT|FIN)$/)) {
				failed.push(`Tag déjà utilisé: ${match.tag}`);
			}
			continue;
		}

		// Vérification 2: Paragraphe cible existe ?
		const targetParagraph = targetParagraphs[match.targetParagraphIndex];
		if (!targetParagraph) {
			failed.push(`Paragraphe non trouvé: index ${match.targetParagraphIndex}`);
			continue;
		}

		// Vérification 3: Paragraphe déjà modifié (sauf si c'est pour les dates) ?
		const existingTags = modifiedParagraphs.get(match.targetParagraphIndex);
		if (existingTags && existingTags.length > 0) {
			// Permettre si c'est une paire de dates différente
			if (!match.tag.match(/_(DEBUT|FIN)$/)) {
				failed.push(`Paragraphe déjà modifié: index ${match.targetParagraphIndex}`);
				continue;
			}
		}

		// Construire le tag complet
		const fullTag = `{{${match.tag}}}`;

		// Extraire le XML du paragraphe actuel
		const paragraphXml = modifiedXml.substring(
			targetParagraph.xmlStart,
			targetParagraph.xmlEnd
		);

		// Appliquer la modification selon le type d'insertion
		const result = applyTagToParagraph(
			paragraphXml,
			fullTag,
			match.insertionPoint,
			targetParagraph
		);

		if (result.success) {
			// Remplacer le paragraphe dans le XML global
			modifiedXml =
				modifiedXml.substring(0, targetParagraph.xmlStart) +
				result.newXml +
				modifiedXml.substring(targetParagraph.xmlEnd);

			// Mettre à jour les positions des paragraphes suivants
			const delta = result.newXml.length - paragraphXml.length;
			updateParagraphPositions(targetParagraphs, match.targetParagraphIndex, delta);

			// Marquer comme utilisés
			applied.push(
				`${match.tag} → paragraphe ${match.targetParagraphIndex} (${match.insertionPoint})`
			);
			usedTags.add(match.tag);
			const existingList = modifiedParagraphs.get(match.targetParagraphIndex) || [];
			modifiedParagraphs.set(match.targetParagraphIndex, [...existingList, match.tag]);
		} else {
			failed.push(`Échec insertion: ${match.tag} (${match.insertionPoint})`);
		}
	}

	return { xml: modifiedXml, applied, failed };
}

// ============================================================================
// INSERTION DANS UN PARAGRAPHE
// ============================================================================

/**
 * Résultat d'une tentative d'insertion de tag.
 */
interface InsertionResult {
	success: boolean;
	newXml: string;
}

/**
 * Applique un tag à un paragraphe selon le type d'insertion.
 *
 * AMÉLIORATION v4.3: Validation MINIMALE
 * - Vérifie uniquement que le tag a été inséré
 * - Pas de validation de structure XML (trop de faux positifs)
 *
 * @param paragraphXml - Le XML du paragraphe
 * @param tag - Le tag à insérer (ex: "{{NOM}}")
 * @param insertionPoint - Le type d'insertion suggéré
 * @param paragraph - Les métadonnées du paragraphe
 * @returns Le résultat de l'insertion
 */
function applyTagToParagraph(
	paragraphXml: string,
	tag: string,
	insertionPoint: string,
	paragraph: TargetParagraph
): InsertionResult {
	// Cas spécial: cellule de tableau (toujours essayer d'abord)
	if (paragraph.isTableCell || insertionPoint === 'table_cell') {
		const result = insertTagInTableCell(paragraphXml, tag);
		// Vérifier simplement que le tag est présent dans le résultat
		if (result.success && result.newXml.includes(tag)) {
			return result;
		}
		// Si échoue, continuer avec les fallbacks
	}

	// Stratégie avec FALLBACK: essayer dans l'ordre de priorité
	const strategies: Array<{ name: string; fn: () => InsertionResult }> = [];

	// 1. D'abord la méthode demandée
	switch (insertionPoint) {
		case 'after_colon':
			strategies.push({ name: 'after_colon', fn: () => insertTagAfterColon(paragraphXml, tag) });
			break;
		case 'replace_empty':
			strategies.push({ name: 'replace_empty', fn: () => insertTagInEmptyCell(paragraphXml, tag, paragraph.text) });
			break;
		case 'inline':
			strategies.push({ name: 'inline', fn: () => insertTagInline(paragraphXml, tag) });
			break;
		case 'checkbox':
			strategies.push({ name: 'checkbox', fn: () => insertTagForCheckbox(paragraphXml, tag) });
			break;
	}

	// 2. Ajouter les fallbacks dans l'ordre de priorité
	// - Cellule de tableau (si pas déjà essayé)
	if (insertionPoint !== 'table_cell' && !paragraph.isTableCell) {
		strategies.push({ name: 'table_cell', fn: () => insertTagInTableCell(paragraphXml, tag) });
	}
	// - Après deux-points (si pas déjà essayé)
	if (insertionPoint !== 'after_colon') {
		strategies.push({ name: 'after_colon_fallback', fn: () => insertTagAfterColon(paragraphXml, tag) });
	}
	// - Cellule vide (si texte court)
	if (insertionPoint !== 'replace_empty' && paragraph.text.trim().length < 10) {
		strategies.push({ name: 'replace_empty_fallback', fn: () => insertTagInEmptyCell(paragraphXml, tag, paragraph.text) });
	}
	// - Inline en dernier recours
	if (insertionPoint !== 'inline') {
		strategies.push({ name: 'inline_fallback', fn: () => insertTagInline(paragraphXml, tag) });
	}

	// Essayer chaque stratégie jusqu'au succès
	// Validation: simplement vérifier que le tag a été inséré
	for (const strategy of strategies) {
		const result = strategy.fn();
		if (result.success && result.newXml.includes(tag)) {
			return result;
		}
	}

	// Aucune stratégie n'a fonctionné
	return { success: false, newXml: paragraphXml };
}

// ============================================================================
// STRATÉGIES D'INSERTION
// ============================================================================

/**
 * Insère un tag après le dernier deux-points dans le paragraphe.
 *
 * Exemple: "Nom commercial :" → "Nom commercial : {{NOM_COMMERCIAL}}"
 */
function insertTagAfterColon(paragraphXml: string, tag: string): InsertionResult {
	// Trouver le dernier <w:t> qui contient ":"
	const textTagRegex = /<w:t([^>]*)>([^<]*)<\/w:t>/g;
	let lastColonMatch: { full: string; text: string; attrs: string } | null = null;
	let match;

	while ((match = textTagRegex.exec(paragraphXml)) !== null) {
		// Ne pas matcher si c'est déjà un tag
		if (match[2].includes(':') && !match[2].includes('{{')) {
			lastColonMatch = {
				full: match[0],
				text: match[2],
				attrs: match[1],
			};
		}
	}

	if (!lastColonMatch) {
		return { success: false, newXml: paragraphXml };
	}

	// Remplacer ":" par ": {{TAG}}" en préservant les espaces
	const newText = lastColonMatch.text.replace(/:(\s*)$/, `: ${tag}$1`);
	const newXml = paragraphXml.replace(
		lastColonMatch.full,
		`<w:t${lastColonMatch.attrs}>${newText}</w:t>`
	);

	return {
		success: newXml !== paragraphXml,
		newXml,
	};
}

/**
 * Insère un tag dans une cellule vide ou presque vide.
 *
 * AMÉLIORATION v4.2: Stratégie simplifiée pour éviter la corruption XML
 */
function insertTagInEmptyCell(
	paragraphXml: string,
	tag: string,
	text: string
): InsertionResult {
	// Vérifier que la cellule est vraiment presque vide
	if (text.trim().length >= 5) {
		return { success: false, newXml: paragraphXml };
	}

	// Chercher un <w:t> existant pour le remplacer
	const textTagRegex = /<w:t([^>]*)>([^<]*)<\/w:t>/;
	const match = paragraphXml.match(textTagRegex);

	if (match) {
		// Remplacer le contenu existant par le tag
		const newXml = paragraphXml.replace(match[0], `<w:t${match[1]}>${tag}</w:t>`);
		return { success: true, newXml };
	}

	// Pas de <w:t>, insérer juste avant </w:r> s'il existe
	const lastRunCloseIndex = paragraphXml.lastIndexOf('</w:r>');
	if (lastRunCloseIndex !== -1) {
		const newXml =
			paragraphXml.substring(0, lastRunCloseIndex) +
			`<w:t>${tag}</w:t>` +
			paragraphXml.substring(lastRunCloseIndex);
		return { success: true, newXml };
	}

	// Pas de <w:r>, insérer un nouveau run avant </w:p>
	const pCloseIndex = paragraphXml.lastIndexOf('</w:p>');
	if (pCloseIndex !== -1) {
		const newXml =
			paragraphXml.substring(0, pCloseIndex) +
			`<w:r><w:t>${tag}</w:t></w:r>` +
			paragraphXml.substring(pCloseIndex);
		return { success: true, newXml };
	}

	return { success: false, newXml: paragraphXml };
}

/**
 * Insère un tag à la fin du texte existant (inline).
 */
function insertTagInline(paragraphXml: string, tag: string): InsertionResult {
	// Trouver le dernier <w:t> du paragraphe
	const textTagRegex = /<w:t([^>]*)>([^<]*)<\/w:t>/g;
	let lastMatch: { full: string; text: string; attrs: string } | null = null;
	let match;

	while ((match = textTagRegex.exec(paragraphXml)) !== null) {
		if (!match[2].includes('{{')) {
			lastMatch = {
				full: match[0],
				text: match[2],
				attrs: match[1],
			};
		}
	}

	if (!lastMatch) {
		return { success: false, newXml: paragraphXml };
	}

	// Ajouter le tag à la fin du texte
	const newText = `${lastMatch.text} ${tag}`;
	const newXml = paragraphXml.replace(
		lastMatch.full,
		`<w:t${lastMatch.attrs}>${newText}</w:t>`
	);

	return { success: true, newXml };
}

/**
 * Insère un tag pour une case à cocher (checkbox).
 */
function insertTagForCheckbox(paragraphXml: string, tag: string): InsertionResult {
	// Même logique que inline : ajouter après le dernier texte
	return insertTagInline(paragraphXml, tag);
}

/**
 * Insère un tag dans une cellule de tableau.
 *
 * Cette fonction gère les cas particuliers des cellules de tableau :
 * - Cellules avec "%" (pour PART_CA) - PRIORITÉ 1
 * - Cellules vides
 * - Cellules avec juste un label
 * - Cellules se terminant par ":"
 */
function insertTagInTableCell(paragraphXml: string, tag: string): InsertionResult {
	// Extraire le texte actuel pour analyser la cellule
	const textContent = extractTextFromXml(paragraphXml).trim();

	// Collecter tous les éléments <w:t>
	const textTagRegex = /<w:t([^>]*)>([^<]*)<\/w:t>/g;
	const textMatches: Array<{ full: string; text: string; attrs: string; index: number }> = [];
	let match;

	while ((match = textTagRegex.exec(paragraphXml)) !== null) {
		textMatches.push({
			full: match[0],
			text: match[2],
			attrs: match[1],
			index: match.index,
		});
	}

	// CAS 1 (PRIORITÉ): Cellule avec "%" → insérer le tag AVANT le symbole %
	// IMPORTANT: Ce cas doit être vérifié AVANT la vérification de cellule vide
	// car "%" a une longueur de 1 caractère
	if (textContent === '%' || textContent.endsWith('%')) {
		// Trouver l'élément contenant le %
		const percentElement = textMatches.find(t => t.text.includes('%'));
		if (percentElement) {
			// Remplacer "%" par "{{TAG}} %"
			const newText = percentElement.text.replace('%', `${tag} %`);
			const newXml = paragraphXml.replace(
				percentElement.full,
				`<w:t${percentElement.attrs}>${newText}</w:t>`
			);
			return { success: true, newXml };
		}
	}

	// CAS 2: Cellule vide ou presque vide (pas de <w:t> ou contenu < 3 caractères)
	if (textMatches.length === 0 || textContent.length < 3) {
		return insertTagInEmptyTableCell(paragraphXml, tag, textMatches);
	}

	// CAS 3: Le texte se termine par ":" → ajouter après
	if (textContent.endsWith(':')) {
		const lastText = textMatches[textMatches.length - 1];
		const newText = lastText.text.replace(/:(\s*)$/, `: ${tag}$1`);
		const newXml = paragraphXml.replace(
			lastText.full,
			`<w:t${lastText.attrs}>${newText}</w:t>`
		);
		return { success: true, newXml };
	}

	// CAS 4: Cellule presque vide (< 10 caractères sans mots significatifs)
	if (textContent.length < 10 && !/[a-zA-ZÀ-ÿ]{3,}/.test(textContent)) {
		const lastText = textMatches[textMatches.length - 1];
		const newXml = paragraphXml.replace(
			lastText.full,
			`<w:t${lastText.attrs}>${tag}</w:t>`
		);
		return { success: true, newXml };
	}

	// CAS 5: Ajouter le tag à la fin du dernier <w:t>
	const lastText = textMatches[textMatches.length - 1];
	const newText = `${lastText.text} ${tag}`;
	const newXml = paragraphXml.replace(
		lastText.full,
		`<w:t${lastText.attrs}>${newText}</w:t>`
	);

	return { success: true, newXml };
}

/**
 * Insère un tag dans une cellule de tableau vide.
 *
 * AMÉLIORATION v4.2: Gestion plus robuste des structures XML
 * - Évite les doublons de balises <w:rPr>
 * - Insère UNIQUEMENT le texte sans restructurer le XML
 * - Validation de la structure avant modification
 */
function insertTagInEmptyTableCell(
	paragraphXml: string,
	tag: string,
	textMatches: Array<{ full: string; text: string; attrs: string }>
): InsertionResult {
	// S'il y a déjà un <w:t>, l'utiliser directement
	if (textMatches.length > 0) {
		const firstText = textMatches[0];
		const newXml = paragraphXml.replace(
			firstText.full,
			`<w:t${firstText.attrs}>${tag}</w:t>`
		);
		return { success: true, newXml };
	}

	// === STRATÉGIE SIMPLIFIÉE: Insérer juste avant </w:r> ===
	// Au lieu de restructurer tout le run, on insère <w:t> juste avant la fermeture

	// Trouver le DERNIER </w:r> pour insérer avant
	const lastRunCloseIndex = paragraphXml.lastIndexOf('</w:r>');
	if (lastRunCloseIndex !== -1) {
		// Vérifier qu'il n'y a pas déjà un <w:t> dans ce run
		// en cherchant le <w:r> correspondant
		const runOpenIndex = paragraphXml.lastIndexOf('<w:r', lastRunCloseIndex);
		if (runOpenIndex !== -1) {
			const runContent = paragraphXml.substring(runOpenIndex, lastRunCloseIndex);
			// S'il y a déjà un <w:t>, ne pas en ajouter un autre
			if (!runContent.includes('<w:t')) {
				const newXml =
					paragraphXml.substring(0, lastRunCloseIndex) +
					`<w:t>${tag}</w:t>` +
					paragraphXml.substring(lastRunCloseIndex);
				return { success: true, newXml };
			}
		}
	}

	// === FALLBACK: Insérer un nouveau run complet ===

	// Vérifier que le paragraphe est bien formé
	if (!paragraphXml.includes('</w:p>')) {
		return { success: false, newXml: paragraphXml };
	}

	// Chercher la position juste avant </w:p> pour insérer
	const pCloseIndex = paragraphXml.lastIndexOf('</w:p>');
	if (pCloseIndex === -1) {
		return { success: false, newXml: paragraphXml };
	}

	// Créer un nouveau run minimal
	const newRun = `<w:r><w:t>${tag}</w:t></w:r>`;
	const newXml =
		paragraphXml.substring(0, pCloseIndex) +
		newRun +
		paragraphXml.substring(pCloseIndex);

	return { success: true, newXml };
}

// ============================================================================
// UTILITAIRES
// ============================================================================

/**
 * Met à jour les positions des paragraphes après une modification.
 *
 * Quand on modifie un paragraphe, la longueur du XML change.
 * Il faut donc ajuster les positions de tous les paragraphes suivants.
 *
 * @param paragraphs - Liste des paragraphes
 * @param modifiedIndex - Index du paragraphe modifié
 * @param delta - Différence de longueur (peut être négative)
 */
function updateParagraphPositions(
	paragraphs: TargetParagraph[],
	modifiedIndex: number,
	delta: number
): void {
	for (const paragraph of paragraphs) {
		if (paragraph.index > modifiedIndex) {
			paragraph.xmlStart += delta;
			paragraph.xmlEnd += delta;
		}
	}
}

// ============================================================================
// GESTION DES PAIRES DE DATES (DEBUT/FIN)
// ============================================================================

/**
 * Interface pour une paire de tags de dates.
 */
interface DateTagPair {
	debutTag: string;
	finTag: string;
	paragraphIndex: number;
}

/**
 * Regroupe les tags DEBUT et FIN qui doivent aller sur le même paragraphe.
 *
 * Les tags comme CA_N_DEBUT et CA_N_FIN doivent être insérés ensemble
 * dans le pattern "Exercice du {{DEBUT}} au {{FIN}}".
 *
 * @param matches - Liste des matches
 * @returns Liste des paires de dates à traiter ensemble
 */
function groupDateTagPairs(matches: MatchResult[]): DateTagPair[] {
	const pairs: DateTagPair[] = [];
	const processedTags = new Set<string>();

	// Trouver tous les tags _DEBUT
	const debutMatches = matches.filter((m) => m.tag.endsWith('_DEBUT'));

	for (const debutMatch of debutMatches) {
		// Trouver le tag _FIN correspondant
		const baseTag = debutMatch.tag.replace('_DEBUT', '');
		const finTag = `${baseTag}_FIN`;
		const finMatch = matches.find(
			(m) => m.tag === finTag && m.targetParagraphIndex === debutMatch.targetParagraphIndex
		);

		if (finMatch) {
			pairs.push({
				debutTag: debutMatch.tag,
				finTag: finTag,
				paragraphIndex: debutMatch.targetParagraphIndex,
			});
			processedTags.add(debutMatch.tag);
			processedTags.add(finTag);
		}
	}

	return pairs;
}

/**
 * Insère une paire de dates dans une ligne d'exercice.
 *
 * Transforme "Exercice du .......... au .........."
 * en "Exercice du {{CA_N_DEBUT}} au {{CA_N_FIN}}"
 *
 * @param paragraphXml - Le XML du paragraphe
 * @param debutTag - Le nom du tag de début (sans accolades)
 * @param finTag - Le nom du tag de fin (sans accolades)
 * @returns Le résultat de l'insertion
 */
function insertDatePairInExerciseLine(
	paragraphXml: string,
	debutTag: string,
	finTag: string
): InsertionResult {
	// Pattern pour trouver "du ..... au ....."
	// Les points peuvent être n'importe quel caractère répété
	const exercisePattern = /(du\s*)([\.…]+|\s{5,})(\s*au\s*)([\.…]+|\s{5,})/gi;

	const fullDebutTag = `{{${debutTag}}}`;
	const fullFinTag = `{{${finTag}}}`;

	// Chercher dans le texte extrait
	const textContent = extractTextFromXml(paragraphXml);

	if (!exercisePattern.test(textContent)) {
		// Pattern non trouvé, essayer d'insérer autrement
		// Chercher juste "du" et "au" séparés
		const simplePattern = /du\s+au/gi;
		if (simplePattern.test(textContent)) {
			// Remplacer dans le XML
			let newXml = paragraphXml;

			// Trouver et remplacer les patterns dans les <w:t>
			newXml = newXml.replace(
				/(<w:t[^>]*>)([^<]*du\s*)([^<]*au\s*)([^<]*)(<\/w:t>)/gi,
				`$1$2${fullDebutTag} $3${fullFinTag}$4$5`
			);

			if (newXml !== paragraphXml) {
				return { success: true, newXml };
			}
		}

		// Fallback: ajouter à la fin
		return insertTagInline(paragraphXml, `${fullDebutTag} au ${fullFinTag}`);
	}

	// Remplacer le pattern dans le XML
	let newXml = paragraphXml;

	// Le pattern peut être réparti sur plusieurs <w:t>, donc on fait plusieurs passes
	// D'abord, essayer de remplacer dans un seul <w:t>
	newXml = newXml.replace(
		/(<w:t[^>]*>)([^<]*)(du\s*)([\.…]+|\s{5,})(\s*au\s*)([\.…]+|\s{5,})([^<]*)(<\/w:t>)/gi,
		`$1$2$3${fullDebutTag}$5${fullFinTag}$7$8`
	);

	if (newXml !== paragraphXml) {
		return { success: true, newXml };
	}

	// Si ça n'a pas marché, le texte est peut-être fragmenté sur plusieurs runs
	// Essayer de reconstruire en cherchant les parties séparément
	const textTags = [...paragraphXml.matchAll(/<w:t([^>]*)>([^<]*)<\/w:t>/g)];

	if (textTags.length === 0) {
		return { success: false, newXml: paragraphXml };
	}

	// Chercher "du" dans les tags et remplacer ce qui suit par DEBUT
	let foundDu = false;
	let foundAu = false;

	for (const textTag of textTags) {
		const text = textTag[2];

		if (!foundDu && /du\s*[\.…]*$/i.test(text)) {
			// Remplacer les points après "du" par le tag DEBUT
			const newText = text.replace(/(du\s*)[\.…]*/i, `$1${fullDebutTag}`);
			newXml = newXml.replace(textTag[0], `<w:t${textTag[1]}>${newText}</w:t>`);
			foundDu = true;
		} else if (!foundDu && /[\.…]+$/.test(text)) {
			// C'est peut-être la suite des points après "du"
			const newText = text.replace(/[\.…]+/, fullDebutTag);
			newXml = newXml.replace(textTag[0], `<w:t${textTag[1]}>${newText}</w:t>`);
			foundDu = true;
		} else if (foundDu && !foundAu && /au\s*[\.…]*$/i.test(text)) {
			// Remplacer les points après "au" par le tag FIN
			const newText = text.replace(/(au\s*)[\.…]*/i, `$1${fullFinTag}`);
			newXml = newXml.replace(textTag[0], `<w:t${textTag[1]}>${newText}</w:t>`);
			foundAu = true;
		} else if (foundDu && !foundAu && /[\.…]+$/.test(text)) {
			// C'est peut-être la suite des points après "au"
			const newText = text.replace(/[\.…]+/, fullFinTag);
			newXml = newXml.replace(textTag[0], `<w:t${textTag[1]}>${newText}</w:t>`);
			foundAu = true;
		}

		if (foundDu && foundAu) break;
	}

	return {
		success: newXml !== paragraphXml,
		newXml,
	};
}
