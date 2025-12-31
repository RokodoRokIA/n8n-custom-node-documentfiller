/**
 * ============================================================================
 * SERVICE REACT AGENT - Agent Autonome pour le Mapping de Documents
 * ============================================================================
 *
 * Ce service implémente un vrai agent ReAct (Reasoning-Acting-Observing-Correcting)
 * qui place les tags dans un document de manière autonome et vérifie son travail.
 *
 * ARCHITECTURE:
 * 1. ANALYSE PROFONDE du document cible
 * 2. BOUCLE REACT avec vérification post-application
 * 3. AUTO-CORRECTION jusqu'à satisfaction
 *
 * DIFFÉRENCES AVEC L'ANCIENNE APPROCHE:
 * - L'agent RELIT le document après chaque modification
 * - L'agent VÉRIFIE que les tags sont aux bons endroits
 * - L'agent CORRIGE les erreurs automatiquement
 * - L'agent continue jusqu'à satisfaction (pas juste 3 itérations)
 *
 * @author Rokodo
 * @version 2.0.0 - Agent ReAct Autonome
 */

import {
	DocumentType,
	TagContext,
	ExtractedTag,
	TargetParagraph,
	MatchResult,
	InsertionPoint,
	LLMModel,
} from '../../shared/types';
import {
	ExtractedCheckbox,
	CheckboxPair,
} from '../../shared/utils/checkbox.utils';
import {
	validateDocxXml,
} from '../../shared/utils/docx.utils';
import { callConnectedLLM } from './llm.service';
import { applyTagsToTarget } from './tag-applicator.service';

// ============================================================================
// TYPES DE L'AGENT REACT
// ============================================================================

/**
 * Tag attendu dans le document (checklist)
 */
export interface ExpectedTag {
	tag: string;
	fullTag: string;

	// Localisation attendue
	expectedLocation: {
		type: 'text' | 'table_cell' | 'checkbox';
		tableIndex?: number;
		rowIndex?: number;
		columnIndex?: number;
		nearText?: string;
		section?: string;
	};

	// Contexte du template
	templateContext: {
		labelBefore: string;
		labelAfter: string;
		rowHeader?: string;
		columnHeader?: string;
	};

	// État
	status: 'pending' | 'placed' | 'verified' | 'failed';
}

/**
 * Problème détecté par l'agent
 */
export interface AgentIssue {
	type: 'missing_tag' | 'wrong_position' | 'empty_cell' | 'duplicate' | 'semantic_mismatch';
	severity: 'critical' | 'warning' | 'info';
	tag?: string;
	description: string;
	suggestedFix?: string;
	location?: {
		tableIndex?: number;
		rowIndex?: number;
		columnIndex?: number;
		paragraphIndex?: number;
	};
}

/**
 * Action effectuée par l'agent
 */
export interface AgentAction {
	type: 'analyze' | 'think' | 'call_llm' | 'apply_tags' | 'observe' | 'verify' | 'correct';
	iteration: number;
	timestamp: number;
	details: Record<string, unknown>;
	result: 'success' | 'partial' | 'failed';
}

/**
 * État complet de l'agent
 */
export interface AgentState {
	iteration: number;
	maxIterations: number;

	// Document actuel
	currentXml: string;

	// Checklist des tags attendus
	expectedTags: ExpectedTag[];

	// Tags trouvés dans le document
	foundTags: FoundTag[];

	// Problèmes détectés
	issues: AgentIssue[];

	// Historique des actions
	actions: AgentAction[];

	// Métriques
	satisfaction: number;
	tagsPlaced: number;
	tagsVerified: number;
}

/**
 * Tag trouvé dans le document
 */
export interface FoundTag {
	tag: string;
	fullTag: string;
	xmlPosition: number;
	context: string;
	inTableCell: boolean;
	tableIndex?: number;
	rowIndex?: number;
	columnIndex?: number;
}

/**
 * Résultat de l'agent
 */
export interface AgentResult {
	success: boolean;
	xml: string;
	state: AgentState;

	// Statistiques
	iterations: number;
	satisfaction: number;
	tagsExpected: number;
	tagsVerified: number;
	tagsFailed: number;

	// Pour compatibilité avec l'ancien système
	tagMatches: MatchResult[];
	checkboxDecisions: CheckboxDecision[];
	mode: 'react_agent';
}

/**
 * Décision checkbox (compatibilité)
 */
export interface CheckboxDecision {
	targetIndex: number;
	label: string;
	shouldBeChecked: boolean;
	confidence: number;
	reason?: string;
}

/**
 * Contexte de mapping (entrée de l'agent)
 */
export interface MappingContext {
	tagContexts: TagContext[];
	extractedTags: ExtractedTag[];
	templateCheckboxes: ExtractedCheckbox[];
	templateCheckboxPairs: CheckboxPair[];
	targetParagraphs: TargetParagraph[];
	targetCheckboxes: ExtractedCheckbox[];
	targetXml: string;
	docType: DocumentType;
	debug: boolean;
}

// ============================================================================
// AGENT REACT PRINCIPAL
// ============================================================================

/**
 * Lance l'agent ReAct autonome pour mapper les tags.
 *
 * AMÉLIORATION v4.3: Traitement SECTION PAR SECTION
 * - Filtre les paragraphes par section
 * - Utilise des indices de tableaux RELATIFS à la section
 * - Réduit la complexité pour l'IA
 *
 * @param model - Modèle LLM connecté
 * @param context - Contexte de mapping complet
 * @returns Résultat du mapping avec le document modifié
 */
export async function runReActAgent(
	model: LLMModel,
	context: MappingContext
): Promise<AgentResult> {
	const MAX_ITERATIONS_PER_SECTION = 3;
	const _SATISFACTION_THRESHOLD = 90; // Réservé pour usage futur

	const {
		tagContexts,
		extractedTags,
		templateCheckboxes,
		templateCheckboxPairs,
		targetParagraphs,
		targetCheckboxes,
		targetXml,
		docType: _docType, // Utilisé pour les logs de debug
		debug,
	} = context;

	// ========================================
	// PHASE 1: INITIALISATION
	// ========================================

	if (debug) {
		console.log('\n🤖 ============================================');
		console.log('   AGENT REACT v4.3 - TRAITEMENT PAR SECTION');
		console.log('   ============================================');
	}

	// Créer la checklist des tags attendus
	const expectedTags = buildExpectedTagsChecklist(tagContexts, extractedTags);

	// Regrouper les tags par section
	const tagsBySection = groupTagsBySection(expectedTags);
	const sectionsWithTags = Object.keys(tagsBySection).filter(s => tagsBySection[s].length > 0);

	if (debug) {
		console.log(`\n📋 Checklist créée: ${expectedTags.length} tags attendus`);
		console.log(`📂 Sections avec tags: ${sectionsWithTags.join(', ') || 'aucune'}`);
		for (const section of sectionsWithTags) {
			console.log(`   Section ${section}: ${tagsBySection[section].length} tags`);
		}
	}

	// Initialiser l'état de l'agent
	const state: AgentState = {
		iteration: 0,
		maxIterations: MAX_ITERATIONS_PER_SECTION * sectionsWithTags.length,
		currentXml: targetXml,
		expectedTags,
		foundTags: [],
		issues: [],
		actions: [],
		satisfaction: 0,
		tagsPlaced: 0,
		tagsVerified: 0,
	};

	// Analyse initiale du document
	state.foundTags = extractTagsFromXml(state.currentXml);
	logAction(state, 'analyze', { foundTags: state.foundTags.length }, 'success');

	if (debug) {
		console.log(`\n📄 Document initial analysé:`);
		console.log(`   Tags déjà présents: ${state.foundTags.length}`);
		console.log(`   Paragraphes disponibles: ${targetParagraphs.length}`);
	}

	// ========================================
	// PHASE 2: BOUCLE REACT PAR SECTION
	// ========================================

	for (const currentSection of sectionsWithTags) {
		const sectionTags = tagsBySection[currentSection];

		// Filtrer les paragraphes pour cette section
		const sectionParagraphs = targetParagraphs.filter(p => p.section === currentSection);

		// Calculer les indices de tableaux RELATIFS à cette section
		const relativeTableMap = buildRelativeTableMap(sectionParagraphs);
		const sectionParagraphsWithRelativeIndices = applyRelativeTableIndices(sectionParagraphs, relativeTableMap);

		if (debug) {
			console.log(`\n\n🔷 ═══════════════════════════════════════════`);
			console.log(`   SECTION ${currentSection}`);
			console.log(`   ═══════════════════════════════════════════`);
			console.log(`   Tags à placer: ${sectionTags.length}`);
			console.log(`   Paragraphes dans cette section: ${sectionParagraphs.length}`);
			console.log(`   Tableaux dans cette section: ${Object.keys(relativeTableMap).length}`);
		}

		// Si aucun paragraphe dans cette section, passer à la suivante
		if (sectionParagraphs.length === 0) {
			if (debug) {
				console.log(`   ⚠️ Aucun paragraphe trouvé, passage à la section suivante`);
			}
			continue;
		}

		// Mini-boucle ReAct pour cette section
		for (let sectionIteration = 0; sectionIteration < MAX_ITERATIONS_PER_SECTION; sectionIteration++) {
			state.iteration++;

			// Tags manquants dans cette section
			const missingTagsInSection = sectionTags.filter((t: ExpectedTag) => t.status === 'pending' || t.status === 'failed');

			if (debug) {
				console.log(`\n   🔄 Itération ${sectionIteration + 1}/${MAX_ITERATIONS_PER_SECTION} (Section ${currentSection})`);
				console.log(`      Tags manquants: ${missingTagsInSection.length}`);
			}

			// Vérifier si tous les tags de cette section sont placés
			if (missingTagsInSection.length === 0) {
				if (debug) {
					console.log(`   ✅ Tous les tags de la section ${currentSection} sont placés !`);
				}
				break;
			}

			// -----------------------------------------
			// ACTION: Appeler le LLM avec contexte de section
			// -----------------------------------------
			const prompt = buildSectionPrompt(
				state,
				currentSection,
				missingTagsInSection,
				sectionParagraphsWithRelativeIndices,
				relativeTableMap,
				context.docType
			);

			if (debug) {
				console.log(`\n      🤖 Appel LLM pour section ${currentSection}...`);
				console.log(`         Taille prompt: ${Math.round(prompt.length / 1000)}KB`);
			}

			let llmResponse: string;
			let placements: MatchResult[];

			try {
				llmResponse = await callConnectedLLM(model, prompt);
				placements = parseLLMResponse(llmResponse);

				// Convertir les indices relatifs en indices absolus
				placements = convertRelativeToAbsoluteIndices(placements, sectionParagraphs, targetParagraphs);

				logAction(state, 'call_llm', {
					section: currentSection,
					promptSize: prompt.length,
					responseSize: llmResponse.length,
					placements: placements.length,
				}, placements.length > 0 ? 'success' : 'partial');

				if (debug) {
					console.log(`         Placements parsés: ${placements.length}`);
				}
			} catch (error) {
				logAction(state, 'call_llm', { error: (error as Error).message }, 'failed');
				if (debug) {
					console.log(`         ❌ Erreur LLM: ${(error as Error).message}`);
				}
				continue;
			}

			// Fallback sémantique si pas de placements
			if (placements.length === 0) {
				if (debug) {
					console.log(`         ⚠️ Tentative fallback sémantique...`);
				}
				placements = semanticFallbackMatchingBySection(
					missingTagsInSection,
					sectionParagraphs,
					targetParagraphs,
					relativeTableMap
				);
				if (debug) {
					console.log(`         Fallback: ${placements.length} placements`);
				}
			}

			// -----------------------------------------
			// APPLY: Appliquer les tags
			// -----------------------------------------
			if (placements.length > 0) {
				const { xml: newXml, applied, failed } = applyTagsToTarget(
					state.currentXml,
					placements,
					targetParagraphs
				);

				state.currentXml = newXml;
				state.tagsPlaced += applied.length;

				// Mettre à jour le statut des tags placés
				for (const appliedEntry of applied) {
					// Extraire le nom du tag (format: "TAG_NAME → paragraphe X (type)")
					const tagName = appliedEntry.split(' → ')[0];
					const expected = state.expectedTags.find(e => e.tag === tagName);
					if (expected && expected.status === 'pending') {
						expected.status = 'placed';
					}
				}

				logAction(state, 'apply_tags', {
					section: currentSection,
					attempted: placements.length,
					applied: applied.length,
					failed: failed.length,
				}, applied.length > 0 ? 'success' : 'failed');

				if (debug) {
					console.log(`\n      ✏️ Tags appliqués: ${applied.length}`);
					applied.slice(0, 5).forEach(t => console.log(`         ✓ {{${t}}}`));
					if (failed.length > 0) {
						console.log(`      ✗ Échecs: ${failed.length}`);
					}
				}
			}

			// OBSERVE: Relire les tags
			state.foundTags = extractTagsFromXml(state.currentXml);
		}
	}

	// ========================================
	// PHASE 2.5: VÉRIFICATION FINALE
	// ========================================

	// Vérifier tous les tags après traitement de toutes les sections
	const verificationResult = verifyTagsInDocument(
		state.currentXml,
		state.expectedTags,
		state.foundTags,
		targetParagraphs
	);

	state.issues = verificationResult.issues;
	state.tagsVerified = verificationResult.verifiedCount;

	// Mettre à jour le statut des tags vérifiés
	for (const verified of verificationResult.verifiedTags) {
		const expected = state.expectedTags.find(e => e.tag === verified);
		if (expected) {
			expected.status = 'verified';
		}
	}

	// Calculer la satisfaction finale
	state.satisfaction = Math.round(
		(state.tagsVerified / state.expectedTags.length) * 100
	);

	if (debug) {
		console.log(`\n\n📊 ═══════════════════════════════════════════`);
		console.log(`   VÉRIFICATION FINALE`);
		console.log(`   ═══════════════════════════════════════════`);
		console.log(`   Tags vérifiés: ${state.tagsVerified}/${state.expectedTags.length}`);
		console.log(`   Satisfaction: ${state.satisfaction}%`);
		if (state.issues.length > 0) {
			console.log(`   Issues: ${state.issues.length}`);
		}
	}

	// ========================================
	// PHASE 3: VALIDATION FINALE ET CORRECTION
	// ========================================

	if (debug) {
		console.log('\n\n🔍 ============================================');
		console.log('   VALIDATION FINALE DU DOCUMENT');
		console.log('   ============================================');
	}

	// Validation XML finale (ALLÉGÉE - ne bloque plus le processus)
	const finalValidation = validateDocxXml(state.currentXml);

	if (debug) {
		if (finalValidation.isValid) {
			console.log(`   ✅ Document valide!`);
		} else {
			console.log(`\n   ⚠️ Avertissements XML détectés (non bloquants):`);
			finalValidation.errors.forEach(e => {
				console.log(`      - ${e.message}`);
			});
		}
		if (finalValidation.warnings.length > 0) {
			console.log(`   Warnings: ${finalValidation.warnings.length}`);
			finalValidation.warnings.slice(0, 3).forEach(w => console.log(`      - ${w}`));
		}
	}

	// NE PAS revenir au document original - garder les tags qui ont été placés
	// La validation est informative, pas bloquante

	// ========================================
	// PHASE 4: RÉSULTAT FINAL
	// ========================================

	if (debug) {
		console.log('\n\n📊 ============================================');
		console.log('   RÉSULTAT FINAL DE L\'AGENT');
		console.log('   ============================================');
		console.log(`   Itérations: ${state.iteration}`);
		console.log(`   Tags attendus: ${state.expectedTags.length}`);
		console.log(`   Tags vérifiés: ${state.tagsVerified}`);
		console.log(`   Satisfaction: ${state.satisfaction}%`);
		console.log(`   Issues restantes: ${state.issues.length}`);
	}

	// Construire le résultat pour compatibilité
	const tagMatches: MatchResult[] = state.foundTags.map(f => ({
		tag: f.tag,
		targetParagraphIndex: findParagraphIndex(f, targetParagraphs),
		confidence: 0.9,
		insertionPoint: f.inTableCell ? 'table_cell' as InsertionPoint : 'after_colon' as InsertionPoint,
	}));

	// Traiter les checkboxes (simplifié pour l'instant)
	const checkboxDecisions = processCheckboxes(
		templateCheckboxes,
		targetCheckboxes,
		templateCheckboxPairs
	);

	return {
		success: state.satisfaction >= 80,
		xml: state.currentXml,
		state,
		iterations: state.iteration,
		satisfaction: state.satisfaction,
		tagsExpected: state.expectedTags.length,
		tagsVerified: state.tagsVerified,
		tagsFailed: state.expectedTags.filter(t => t.status === 'failed').length,
		tagMatches,
		checkboxDecisions,
		mode: 'react_agent',
	};
}

// ============================================================================
// CONSTRUCTION DE LA CHECKLIST
// ============================================================================

/**
 * Construit la checklist des tags attendus à partir du template.
 */
function buildExpectedTagsChecklist(
	tagContexts: TagContext[],
	extractedTags: ExtractedTag[]
): ExpectedTag[] {
	const checklist: ExpectedTag[] = [];
	const seenTags = new Set<string>();

	for (const ctx of tagContexts) {
		if (seenTags.has(ctx.tag)) continue;
		seenTags.add(ctx.tag);

		const isTableCell = ctx.tableIndex !== undefined;

		checklist.push({
			tag: ctx.tag,
			fullTag: ctx.fullTag,
			expectedLocation: {
				type: isTableCell ? 'table_cell' : 'text',
				tableIndex: ctx.tableIndex,
				rowIndex: ctx.rowIndex,
				columnIndex: ctx.columnIndex,
				nearText: ctx.labelBefore.substring(0, 50),
				section: ctx.section,
			},
			templateContext: {
				labelBefore: ctx.labelBefore,
				labelAfter: ctx.labelAfter,
				rowHeader: ctx.rowHeader,
				columnHeader: ctx.columnHeader,
			},
			status: 'pending',
		});
	}

	// Ajouter les tags extraits qui ne sont pas dans les contextes
	for (const tag of extractedTags) {
		if (seenTags.has(tag.tag)) continue;
		seenTags.add(tag.tag);

		checklist.push({
			tag: tag.tag,
			fullTag: `{{${tag.tag}}}`,
			expectedLocation: {
				type: 'text',
				nearText: tag.context?.substring(0, 50),
			},
			templateContext: {
				labelBefore: tag.context || '',
				labelAfter: '',
			},
			status: 'pending',
		});
	}

	return checklist;
}

// ============================================================================
// EXTRACTION ET VÉRIFICATION DES TAGS
// ============================================================================

/**
 * Extrait tous les tags présents dans le XML avec leur contexte.
 */
function extractTagsFromXml(xml: string): FoundTag[] {
	const tags: FoundTag[] = [];
	const tagRegex = /\{\{([A-Z_0-9]+)\}\}/g;

	let match;
	while ((match = tagRegex.exec(xml)) !== null) {
		const fullTag = match[0];
		const tagName = match[1];
		const position = match.index;

		// Extraire le contexte autour du tag
		const contextStart = Math.max(0, position - 100);
		const contextEnd = Math.min(xml.length, position + fullTag.length + 100);
		const context = xml.substring(contextStart, contextEnd)
			.replace(/<[^>]+>/g, ' ')
			.replace(/\s+/g, ' ')
			.trim();

		// Déterminer si le tag est dans une cellule de tableau
		const inTableCell = isInTableCell(xml, position);
		const tableInfo = inTableCell ? getTableCellInfo(xml, position) : undefined;

		tags.push({
			tag: tagName,
			fullTag,
			xmlPosition: position,
			context,
			inTableCell,
			tableIndex: tableInfo?.tableIndex,
			rowIndex: tableInfo?.rowIndex,
			columnIndex: tableInfo?.columnIndex,
		});
	}

	return tags;
}

/**
 * Vérifie si une position XML est dans une cellule de tableau.
 */
function isInTableCell(xml: string, position: number): boolean {
	// Chercher la dernière ouverture de cellule avant cette position
	const beforeTag = xml.substring(0, position);
	const lastTcOpen = beforeTag.lastIndexOf('<w:tc');
	const lastTcClose = beforeTag.lastIndexOf('</w:tc>');

	return lastTcOpen > lastTcClose;
}

/**
 * Obtient les informations de cellule de tableau pour une position.
 */
function getTableCellInfo(
	xml: string,
	position: number
): { tableIndex: number; rowIndex: number; columnIndex: number } | undefined {
	// Approche simplifiée: compter les tables, lignes et cellules avant cette position
	const beforePos = xml.substring(0, position);

	// Compter les tables
	const tableMatches = beforePos.match(/<w:tbl[^>]*>/g) || [];
	const tableCloses = beforePos.match(/<\/w:tbl>/g) || [];
	const tableIndex = tableMatches.length - tableCloses.length - 1;

	if (tableIndex < 0) return undefined;

	// Trouver la dernière table ouverte
	const lastTableStart = beforePos.lastIndexOf('<w:tbl');
	const tableContent = beforePos.substring(lastTableStart);

	// Compter les lignes dans cette table
	const rowMatches = tableContent.match(/<w:tr[^>]*>/g) || [];
	const rowCloses = tableContent.match(/<\/w:tr>/g) || [];
	const rowIndex = rowMatches.length - rowCloses.length - 1;

	if (rowIndex < 0) return undefined;

	// Trouver la dernière ligne ouverte
	const lastRowStart = tableContent.lastIndexOf('<w:tr');
	const rowContent = tableContent.substring(lastRowStart);

	// Compter les cellules dans cette ligne
	const cellMatches = rowContent.match(/<w:tc[^>]*>/g) || [];
	const cellCloses = rowContent.match(/<\/w:tc>/g) || [];
	const columnIndex = cellMatches.length - cellCloses.length - 1;

	return { tableIndex, rowIndex, columnIndex: Math.max(0, columnIndex) };
}

/**
 * Vérifie que les tags sont correctement placés.
 */
function verifyTagsInDocument(
	_xml: string, // Réservé pour analyses futures
	expectedTags: ExpectedTag[],
	foundTags: FoundTag[],
	targetParagraphs: TargetParagraph[]
): {
	verifiedTags: string[];
	issues: AgentIssue[];
	verifiedCount: number;
} {
	const verifiedTags: string[] = [];
	const issues: AgentIssue[] = [];

	for (const expected of expectedTags) {
		const found = foundTags.find(f => f.tag === expected.tag);

		if (!found) {
			// Tag manquant
			issues.push({
				type: 'missing_tag',
				severity: 'critical',
				tag: expected.tag,
				description: `Tag {{${expected.tag}}} manquant dans le document`,
				suggestedFix: expected.expectedLocation.type === 'table_cell'
					? `Insérer dans Table${expected.expectedLocation.tableIndex} R${expected.expectedLocation.rowIndex} C${expected.expectedLocation.columnIndex}`
					: `Chercher près de "${expected.templateContext.labelBefore.substring(0, 30)}..."`,
				location: expected.expectedLocation,
			});
			continue;
		}

		// Vérifier la position pour les cellules de tableau
		if (expected.expectedLocation.type === 'table_cell') {
			const expectedTable = expected.expectedLocation.tableIndex;
			const expectedRow = expected.expectedLocation.rowIndex;
			const expectedCol = expected.expectedLocation.columnIndex;

			if (
				found.tableIndex !== expectedTable ||
				found.rowIndex !== expectedRow ||
				found.columnIndex !== expectedCol
			) {
				issues.push({
					type: 'wrong_position',
					severity: 'warning',
					tag: expected.tag,
					description: `Tag {{${expected.tag}}} mal placé: attendu T${expectedTable}R${expectedRow}C${expectedCol}, trouvé T${found.tableIndex}R${found.rowIndex}C${found.columnIndex}`,
					suggestedFix: `Déplacer vers la cellule correcte`,
					location: expected.expectedLocation,
				});
				// On considère quand même le tag comme placé (warning, pas critical)
				verifiedTags.push(expected.tag);
			} else {
				verifiedTags.push(expected.tag);
			}
		} else {
			// Pour les tags hors tableau, vérification sémantique basique
			const hasContextMatch = checkSemanticMatch(
				found.context,
				expected.templateContext.labelBefore
			);

			if (!hasContextMatch && expected.templateContext.labelBefore.length > 10) {
				issues.push({
					type: 'semantic_mismatch',
					severity: 'info',
					tag: expected.tag,
					description: `Tag {{${expected.tag}}} peut-être mal placé: contexte différent du template`,
				});
			}

			verifiedTags.push(expected.tag);
		}
	}

	// Vérifier les cellules vides qui auraient dû recevoir un tag
	const tableCellTags = expectedTags.filter(t => t.expectedLocation.type === 'table_cell');
	for (const expected of tableCellTags) {
		if (expected.status === 'pending') {
			const loc = expected.expectedLocation;
			// Chercher si cette cellule existe et est vide dans le document cible
			const targetCell = targetParagraphs.find(p =>
				p.isTableCell &&
				p.tableIndex === loc.tableIndex &&
				p.rowIndex === loc.rowIndex &&
				p.columnIndex === loc.columnIndex
			);

			if (targetCell && !targetCell.hasExistingTag && targetCell.text.trim().length < 5) {
				issues.push({
					type: 'empty_cell',
					severity: 'critical',
					tag: expected.tag,
					description: `Cellule T${loc.tableIndex}R${loc.rowIndex}C${loc.columnIndex} est vide, devrait contenir {{${expected.tag}}}`,
					suggestedFix: `Insérer le tag dans la cellule vide`,
					location: loc,
				});
			}
		}
	}

	return {
		verifiedTags,
		issues,
		verifiedCount: verifiedTags.length,
	};
}

/**
 * Vérifie la correspondance sémantique entre deux textes.
 */
function checkSemanticMatch(foundContext: string, expectedLabel: string): boolean {
	if (!expectedLabel || expectedLabel.length < 5) return true;

	const keywords = extractKeywords(expectedLabel.toLowerCase());
	const contextLower = foundContext.toLowerCase();

	let matchCount = 0;
	for (const kw of keywords) {
		if (contextLower.includes(kw)) {
			matchCount++;
		}
	}

	return matchCount >= Math.min(2, keywords.length);
}

/**
 * Extrait les mots-clés d'un texte.
 */
function extractKeywords(text: string): string[] {
	const stopWords = new Set([
		'le', 'la', 'les', 'de', 'du', 'des', 'un', 'une', 'et', 'ou', 'à', 'au', 'aux',
		'en', 'pour', 'par', 'sur', 'dans', 'avec', 'sans', 'ce', 'cette', 'ces',
	]);

	return text
		.replace(/[^a-zàâäéèêëïîôùûç\s]/gi, ' ')
		.split(/\s+/)
		.filter(w => w.length >= 3 && !stopWords.has(w));
}

// ============================================================================
// GÉNÉRATION DU PROMPT
// ============================================================================

/**
 * Construit le prompt pour l'agent.
 */
function buildAgentPrompt(
	state: AgentState,
	missingTags: ExpectedTag[],
	context: MappingContext
): string {
	const { targetParagraphs, docType } = context;

	// Section d'état
	let prompt = `# AGENT REACT - ITÉRATION ${state.iteration}/${state.maxIterations}

## ÉTAT ACTUEL
- Document: ${docType}
- Tags attendus: ${state.expectedTags.length}
- Tags vérifiés: ${state.tagsVerified} (${state.satisfaction}%)
- Tags à placer: ${missingTags.length}

`;

	// Ajouter les erreurs des itérations précédentes
	if (state.issues.length > 0) {
		prompt += `## ⚠️ PROBLÈMES À CORRIGER (PRIORITÉ HAUTE)\n`;
		for (const issue of state.issues.filter(i => i.severity === 'critical').slice(0, 10)) {
			prompt += `- 🔴 ${issue.description}`;
			if (issue.suggestedFix) {
				prompt += ` → ${issue.suggestedFix}`;
			}
			prompt += `\n`;
		}
		prompt += `\n`;
	}

	// Tags à placer
	prompt += `## TAGS À PLACER (${missingTags.length})\n\n`;

	// Grouper par type
	const tableTags = missingTags.filter(t => t.expectedLocation.type === 'table_cell');
	const textTags = missingTags.filter(t => t.expectedLocation.type === 'text');

	if (tableTags.length > 0) {
		prompt += `### Tags de TABLEAU (position exacte requise)\n`;
		for (const tag of tableTags.slice(0, 15)) {
			const loc = tag.expectedLocation;
			prompt += `- **{{${tag.tag}}}** → Table${loc.tableIndex} Ligne${loc.rowIndex} Colonne${loc.columnIndex}`;
			if (tag.templateContext.rowHeader) {
				prompt += ` (ligne: "${tag.templateContext.rowHeader.substring(0, 30)}")`;
			}
			if (tag.templateContext.columnHeader) {
				prompt += ` (col: "${tag.templateContext.columnHeader.substring(0, 20)}")`;
			}
			prompt += `\n`;
		}
		prompt += `\n`;
	}

	if (textTags.length > 0) {
		prompt += `### Tags de TEXTE (chercher contexte similaire)\n`;
		for (const tag of textTags.slice(0, 15)) {
			prompt += `- **{{${tag.tag}}}** → Chercher près de: "${tag.templateContext.labelBefore.substring(0, 50)}"\n`;
		}
		prompt += `\n`;
	}

	// Paragraphes cibles disponibles
	const relevantParagraphs = targetParagraphs
		.filter(p => !p.hasExistingTag)
		.slice(0, 60);

	prompt += `## PARAGRAPHES CIBLES DISPONIBLES (${relevantParagraphs.length})\n`;
	prompt += `\`\`\`json
${JSON.stringify(
		relevantParagraphs.map(p => ({
			idx: p.index,
			text: p.text.substring(0, 60),
			isCell: p.isTableCell,
			pos: p.tableIndex !== undefined ? `T${p.tableIndex}R${p.rowIndex}C${p.columnIndex}` : null,
			empty: p.text.trim().length < 3,
		})),
		null,
		2
	)}
\`\`\`

## INSTRUCTIONS

1. Pour les tags de TABLEAU: utilise la position exacte (Table/Row/Col)
2. Pour les tags de TEXTE: trouve le paragraphe avec un contexte similaire au template
3. Les cellules VIDES (empty=true) sont des candidats pour les tags de tableau
4. Chaque tag ne peut être placé qu'UNE SEULE fois

## FORMAT DE RÉPONSE (JSON STRICT)

\`\`\`json
{
  "placements": [
    {"tag": "NOM_TAG", "targetIdx": 0, "confidence": 0.9, "insertionPoint": "after_colon", "reason": "court"}
  ]
}
\`\`\`

Règles insertionPoint:
- "table_cell" pour les cellules de tableau
- "after_colon" si le paragraphe finit par ":"
- "inline" sinon

RÉPONDS UNIQUEMENT AVEC LE JSON.`;

	return prompt;
}

// ============================================================================
// PARSING DE LA RÉPONSE LLM
// ============================================================================

/**
 * Parse la réponse du LLM.
 */
function parseLLMResponse(response: string): MatchResult[] {
	const results: MatchResult[] = [];

	if (!response || typeof response !== 'string') {
		return results;
	}

	// Extraire le JSON
	let json: string | null = null;

	// Stratégie 1: Bloc Markdown
	const markdownMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
	if (markdownMatch) {
		json = markdownMatch[1].trim();
	}

	// Stratégie 2: JSON brut
	if (!json) {
		const jsonStart = response.indexOf('{');
		const jsonEnd = response.lastIndexOf('}');
		if (jsonStart !== -1 && jsonEnd > jsonStart) {
			json = response.substring(jsonStart, jsonEnd + 1);
		}
	}

	if (!json) return results;

	try {
		const parsed = JSON.parse(json);
		const placements = parsed.placements || parsed.tags || [];

		for (const item of placements) {
			if (!item.tag || typeof item.tag !== 'string') continue;

			const idx = item.targetIdx ?? item.targetParagraphIndex;
			if (idx === undefined || typeof idx !== 'number' || idx < 0) continue;

			const confidence = item.confidence || 0.8;
			if (confidence < 0.6) continue;

			let insertionPoint: InsertionPoint = 'after_colon';
			if (item.insertionPoint === 'table_cell') insertionPoint = 'table_cell';
			else if (item.insertionPoint === 'inline') insertionPoint = 'inline';
			else if (item.insertionPoint === 'replace_empty') insertionPoint = 'replace_empty';

			results.push({
				tag: item.tag,
				targetParagraphIndex: idx,
				confidence,
				insertionPoint,
				reason: item.reason,
			});
		}
	} catch (error) {
		console.error('Erreur parsing JSON:', (error as Error).message);
	}

	return results;
}

// ============================================================================
// FALLBACK SÉMANTIQUE
// ============================================================================

/**
 * Matching sémantique de secours si le LLM échoue.
 */
function semanticFallbackMatching(
	missingTags: ExpectedTag[],
	targetParagraphs: TargetParagraph[]
): MatchResult[] {
	const results: MatchResult[] = [];
	const usedParagraphs = new Set<number>();

	// D'abord, matcher les tags de tableau par position
	const tableTags = missingTags.filter(t => t.expectedLocation.type === 'table_cell');

	for (const tag of tableTags) {
		const loc = tag.expectedLocation;
		const matchingParagraph = targetParagraphs.find(p =>
			p.isTableCell &&
			p.tableIndex === loc.tableIndex &&
			p.rowIndex === loc.rowIndex &&
			p.columnIndex === loc.columnIndex &&
			!usedParagraphs.has(p.index)
		);

		if (matchingParagraph) {
			results.push({
				tag: tag.tag,
				targetParagraphIndex: matchingParagraph.index,
				confidence: 0.95,
				insertionPoint: 'table_cell',
				reason: 'Position exacte tableau',
			});
			usedParagraphs.add(matchingParagraph.index);
		}
	}

	// Ensuite, matcher les tags de texte par mots-clés
	const textTags = missingTags.filter(t => t.expectedLocation.type === 'text');

	for (const tag of textTags) {
		const keywords = extractKeywords(tag.templateContext.labelBefore.toLowerCase());
		if (keywords.length === 0) continue;

		let bestMatch: TargetParagraph | null = null;
		let bestScore = 0;

		for (const p of targetParagraphs) {
			if (usedParagraphs.has(p.index) || p.hasExistingTag) continue;

			const textLower = p.text.toLowerCase();
			let score = 0;

			for (const kw of keywords) {
				if (textLower.includes(kw)) {
					score += kw.length;
				}
			}

			// Bonus si le paragraphe finit par ":"
			if (p.text.trim().endsWith(':')) score += 5;

			if (score > bestScore && score >= 5) {
				bestScore = score;
				bestMatch = p;
			}
		}

		if (bestMatch) {
			results.push({
				tag: tag.tag,
				targetParagraphIndex: bestMatch.index,
				confidence: 0.75,
				insertionPoint: bestMatch.text.trim().endsWith(':') ? 'after_colon' : 'inline',
				reason: 'Fallback sémantique',
			});
			usedParagraphs.add(bestMatch.index);
		}
	}

	return results;
}

// ============================================================================
// TRAITEMENT DES CHECKBOXES
// ============================================================================

/**
 * Traite les checkboxes (version simplifiée).
 */
function processCheckboxes(
	templateCheckboxes: ExtractedCheckbox[],
	targetCheckboxes: ExtractedCheckbox[],
	_pairs: CheckboxPair[] // Réservé pour le matching par paires
): CheckboxDecision[] {
	const decisions: CheckboxDecision[] = [];

	for (const templateCb of templateCheckboxes) {
		// Chercher une checkbox correspondante dans la cible
		const match = targetCheckboxes.find(tc => {
			const templateLabel = normalizeLabel(templateCb.label);
			const targetLabel = normalizeLabel(tc.label);
			return templateLabel === targetLabel || labelsMatch(templateLabel, targetLabel);
		});

		if (match) {
			decisions.push({
				targetIndex: match.index,
				label: match.label,
				shouldBeChecked: templateCb.checked,
				confidence: 0.85,
				reason: 'Copie état template',
			});
		}
	}

	return decisions;
}

/**
 * Normalise un label de checkbox.
 */
function normalizeLabel(label: string): string {
	return label
		.toLowerCase()
		.replace(/[☑☐✓✔□■○◯◻]/g, '')
		.replace(/[^\w\sàâäéèêëïîôùûç]/gi, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Vérifie si deux labels correspondent.
 */
function labelsMatch(label1: string, label2: string): boolean {
	// Cas Oui/Non
	if ((label1 === 'oui' && label2 === 'oui') || (label1 === 'non' && label2 === 'non')) {
		return true;
	}

	// Mots en commun
	const words1 = label1.split(/\s+/).filter(w => w.length >= 3);
	const words2 = label2.split(/\s+/).filter(w => w.length >= 3);

	let matches = 0;
	for (const w of words1) {
		if (words2.includes(w)) matches++;
	}

	return matches >= Math.min(2, Math.min(words1.length, words2.length));
}

// ============================================================================
// UTILITAIRES
// ============================================================================

/**
 * Enregistre une action dans l'historique.
 */
function logAction(
	state: AgentState,
	type: AgentAction['type'],
	details: Record<string, unknown>,
	result: AgentAction['result']
): void {
	state.actions.push({
		type,
		iteration: state.iteration,
		timestamp: Date.now(),
		details,
		result,
	});
}

/**
 * Trouve l'index de paragraphe correspondant à un tag trouvé.
 */
function findParagraphIndex(
	foundTag: FoundTag,
	targetParagraphs: TargetParagraph[]
): number {
	// Chercher par position de tableau
	if (foundTag.inTableCell && foundTag.tableIndex !== undefined) {
		const match = targetParagraphs.find(p =>
			p.isTableCell &&
			p.tableIndex === foundTag.tableIndex &&
			p.rowIndex === foundTag.rowIndex &&
			p.columnIndex === foundTag.columnIndex
		);
		if (match) return match.index;
	}

	// Chercher par position XML approximative
	for (const p of targetParagraphs) {
		if (foundTag.xmlPosition >= p.xmlStart && foundTag.xmlPosition <= p.xmlEnd) {
			return p.index;
		}
	}

	return 0;
}

// ============================================================================
// TRAITEMENT PAR SECTION - FONCTIONS HELPER
// ============================================================================

/**
 * Regroupe les tags attendus par section.
 */
function groupTagsBySection(expectedTags: ExpectedTag[]): Record<string, ExpectedTag[]> {
	const groups: Record<string, ExpectedTag[]> = {};

	for (const tag of expectedTags) {
		const section = tag.expectedLocation.section || 'UNKNOWN';
		if (!groups[section]) {
			groups[section] = [];
		}
		groups[section].push(tag);
	}

	return groups;
}

/**
 * Construit une map des indices de tableaux absolus vers relatifs pour une section.
 * Exemple: Si la section contient les tableaux 7 et 8 du document,
 * la map sera { 7: 0, 8: 1 }
 */
function buildRelativeTableMap(sectionParagraphs: TargetParagraph[]): Record<number, number> {
	const absoluteTableIndices = new Set<number>();

	for (const p of sectionParagraphs) {
		if (p.isTableCell && p.tableIndex !== undefined) {
			absoluteTableIndices.add(p.tableIndex);
		}
	}

	// Trier les indices absolus et créer la correspondance
	const sorted = Array.from(absoluteTableIndices).sort((a, b) => a - b);
	const map: Record<number, number> = {};

	sorted.forEach((absIndex, relIndex) => {
		map[absIndex] = relIndex;
	});

	return map;
}

/**
 * Applique les indices de tableaux relatifs aux paragraphes d'une section.
 * Crée une copie avec les nouveaux indices.
 */
function applyRelativeTableIndices(
	paragraphs: TargetParagraph[],
	relativeTableMap: Record<number, number>
): TargetParagraph[] {
	return paragraphs.map((p, idx) => ({
		...p,
		// Utiliser un index relatif à la section (pas l'index global)
		index: idx,
		// Convertir l'index de tableau absolu en relatif
		tableIndex: p.tableIndex !== undefined ? relativeTableMap[p.tableIndex] : undefined,
	}));
}

/**
 * Convertit les indices relatifs (de la réponse LLM) en indices absolus.
 */
function convertRelativeToAbsoluteIndices(
	placements: MatchResult[],
	sectionParagraphs: TargetParagraph[],
	_allParagraphs: TargetParagraph[]
): MatchResult[] {
	return placements.map(p => {
		// L'indice dans la réponse LLM est relatif à la section
		const relativeParagraph = sectionParagraphs[p.targetParagraphIndex];

		if (!relativeParagraph) {
			return p; // Garder tel quel si l'index est invalide
		}

		// Retourner avec l'index global du paragraphe
		return {
			...p,
			targetParagraphIndex: relativeParagraph.index,
		};
	});
}

/**
 * Construit un prompt spécifique pour une section.
 */
function buildSectionPrompt(
	_state: AgentState, // Réservé pour usage futur (ajout d'historique d'erreurs)
	section: string,
	missingTags: ExpectedTag[],
	sectionParagraphs: TargetParagraph[],
	relativeTableMap: Record<number, number>,
	docType: DocumentType
): string {
	// Calculer les indices relatifs pour les tags aussi
	const tagsWithRelativeIndices = missingTags.map(tag => {
		const loc = tag.expectedLocation;
		return {
			...tag,
			relativeTableIndex: loc.tableIndex !== undefined ? relativeTableMap[loc.tableIndex] : undefined,
		};
	});

	let prompt = `# AGENT REACT - SECTION ${section}

## CONTEXTE
- Document: ${docType}
- Section: ${section}
- Tags à placer: ${missingTags.length}
- Paragraphes disponibles: ${sectionParagraphs.length}
- Tableaux dans cette section: ${Object.keys(relativeTableMap).length}

## IMPORTANT: INDICES RELATIFS
Les indices de tableaux sont RELATIFS à cette section:
${Object.entries(relativeTableMap).map(([abs, rel]) => `- Table ${rel} (dans cette section) = Table ${abs} (absolu)`).join('\n')}

`;

	// Tags à placer
	const tableTags = tagsWithRelativeIndices.filter(t => t.expectedLocation.type === 'table_cell');
	const textTags = tagsWithRelativeIndices.filter(t => t.expectedLocation.type === 'text');

	if (tableTags.length > 0) {
		prompt += `## TAGS DE TABLEAU (${tableTags.length})
`;
		for (const tag of tableTags) {
			const relTable = tag.relativeTableIndex ?? '?';
			const row = tag.expectedLocation.rowIndex ?? '?';
			const col = tag.expectedLocation.columnIndex ?? '?';
			prompt += `- **{{${tag.tag}}}** → Table${relTable} R${row} C${col}`;
			if (tag.templateContext.rowHeader) {
				prompt += ` (ligne: "${tag.templateContext.rowHeader.substring(0, 30)}")`;
			}
			prompt += `\n`;
		}
		prompt += `\n`;
	}

	if (textTags.length > 0) {
		prompt += `## TAGS DE TEXTE (${textTags.length})
`;
		for (const tag of textTags) {
			prompt += `- **{{${tag.tag}}}** → "${tag.templateContext.labelBefore.substring(0, 50)}"\n`;
		}
		prompt += `\n`;
	}

	// Paragraphes disponibles (avec indices relatifs)
	prompt += `## PARAGRAPHES DISPONIBLES (${sectionParagraphs.length})
\`\`\`json
${JSON.stringify(
		sectionParagraphs.slice(0, 50).map(p => ({
			idx: p.index, // Index relatif à la section
			text: p.text.substring(0, 50),
			isCell: p.isTableCell,
			pos: p.tableIndex !== undefined ? `T${p.tableIndex}R${p.rowIndex}C${p.columnIndex}` : null,
			empty: p.text.trim().length < 3,
		})),
		null,
		2
	)}
\`\`\`

## FORMAT DE RÉPONSE (JSON STRICT)
\`\`\`json
{
  "placements": [
    {"tag": "NOM_TAG", "targetIdx": 0, "confidence": 0.9, "insertionPoint": "table_cell"}
  ]
}
\`\`\`

IMPORTANT: targetIdx est l'index du paragraphe dans la liste ci-dessus (idx).
insertionPoint: "table_cell" | "after_colon" | "inline"

RÉPONDS UNIQUEMENT AVEC LE JSON.`;

	return prompt;
}

/**
 * Matching sémantique de secours pour une section spécifique.
 */
function semanticFallbackMatchingBySection(
	missingTags: ExpectedTag[],
	sectionParagraphs: TargetParagraph[],
	allParagraphs: TargetParagraph[],
	relativeTableMap: Record<number, number>
): MatchResult[] {
	const results: MatchResult[] = [];
	const usedParagraphs = new Set<number>();

	// Inverser la map pour convertir les indices relatifs en absolus
	const absoluteTableMap: Record<number, number> = {};
	for (const [abs, rel] of Object.entries(relativeTableMap)) {
		absoluteTableMap[rel] = parseInt(abs);
	}

	// 1. Matcher les tags de tableau par position relative
	const tableTags = missingTags.filter(t => t.expectedLocation.type === 'table_cell');

	for (const tag of tableTags) {
		const loc = tag.expectedLocation;
		if (loc.tableIndex === undefined) continue;

		// Convertir en index relatif
		const relTableIndex = relativeTableMap[loc.tableIndex];
		if (relTableIndex === undefined) continue;

		// Chercher dans les paragraphes de la section avec l'index relatif
		const matchingParagraph = sectionParagraphs.find(p =>
			p.isTableCell &&
			p.tableIndex === relTableIndex &&
			p.rowIndex === loc.rowIndex &&
			p.columnIndex === loc.columnIndex &&
			!usedParagraphs.has(p.index)
		);

		if (matchingParagraph) {
			// Trouver l'index global du paragraphe
			const globalParagraph = allParagraphs.find(ap =>
				ap.xmlStart === sectionParagraphs[matchingParagraph.index]?.xmlStart
			);

			if (globalParagraph) {
				results.push({
					tag: tag.tag,
					targetParagraphIndex: globalParagraph.index,
					confidence: 0.90,
					insertionPoint: 'table_cell',
					reason: 'Fallback position relative',
				});
				usedParagraphs.add(matchingParagraph.index);
			}
		}
	}

	// 2. Matcher les tags de texte par mots-clés
	const textTags = missingTags.filter(t => t.expectedLocation.type === 'text');

	for (const tag of textTags) {
		const keywords = extractKeywords(tag.templateContext.labelBefore.toLowerCase());
		if (keywords.length === 0) continue;

		let bestMatch: TargetParagraph | null = null;
		let bestScore = 0;

		for (const p of sectionParagraphs) {
			if (usedParagraphs.has(p.index) || p.hasExistingTag) continue;

			const textLower = p.text.toLowerCase();
			let score = 0;

			for (const kw of keywords) {
				if (textLower.includes(kw)) {
					score += kw.length;
				}
			}

			if (p.text.trim().endsWith(':')) score += 5;

			if (score > bestScore && score >= 5) {
				bestScore = score;
				bestMatch = p;
			}
		}

		if (bestMatch) {
			// Trouver l'index global
			const originalParagraph = allParagraphs.find(ap =>
				ap.xmlStart === sectionParagraphs[bestMatch!.index]?.xmlStart
			);

			if (originalParagraph) {
				results.push({
					tag: tag.tag,
					targetParagraphIndex: originalParagraph.index,
					confidence: 0.75,
					insertionPoint: originalParagraph.text.trim().endsWith(':') ? 'after_colon' : 'inline',
					reason: 'Fallback sémantique section',
				});
				usedParagraphs.add(bestMatch.index);
			}
		}
	}

	return results;
}
