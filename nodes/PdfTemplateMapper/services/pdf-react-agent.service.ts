/**
 * ============================================================================
 * SERVICE PDF REACT AGENT - Agent ReAct pour le remplissage de PDF
 * ============================================================================
 *
 * Ce service implémente un agent ReAct (Reasoning-Acting-Observing-Correcting)
 * pour placer intelligemment les valeurs dans un PDF.
 *
 * ARCHITECTURE:
 * 1. REASON: Analyser le PDF et identifier les sections/labels
 * 2. ACT: Demander au LLM de trouver les meilleures positions
 * 3. OBSERVE: Vérifier les placements dans le PDF généré
 * 4. CORRECT: Ajuster si nécessaire
 *
 * @author Rokodo
 * @version 1.0.0
 */

import { LLMModel } from '../../shared/types';
import { fillPdf, fillCheckboxes } from './pdf-filler.service';
import { extractPdfContent } from './pdf-extractor.service';

// ============================================================================
// TYPES
// ============================================================================

export interface Position {
	x: number;
	y: number;
	page: number;
	type: 'inline' | 'multiline';
	labelY?: number;
	confidence?: number;
}

export interface FieldConfig {
	labels: string[];
	type: 'inline' | 'multiline' | 'checkbox';
	minGap?: number;
}

export interface PdfMappingContext {
	pdfContent: Awaited<ReturnType<typeof extractPdfContent>>;
	targetPageNumber: number;
	fillData: Record<string, string>;
	fieldConfig: Record<string, FieldConfig>;
	checkboxData?: Record<string, boolean>;
	sectionMarker?: string;
	debug: boolean;
}

export interface AgentResult {
	success: boolean;
	pdfBuffer: Buffer;
	positions: Record<string, Position | null>;
	iterations: number;
	satisfaction: number;
	llmCalls: number;
	corrections: number;
	verified: number;
	checkboxesPlaced: number;
	issues: string[];
}

// ============================================================================
// AGENT REACT PRINCIPAL
// ============================================================================

const MAX_ITERATIONS = 5; // Augmenté pour permettre plus de corrections
const SATISFACTION_THRESHOLD = 80;

/**
 * Lance l'agent ReAct pour mapper et remplir le PDF.
 */
export async function runPdfReActAgent(
	model: LLMModel,
	context: PdfMappingContext,
	pdfBuffer: Buffer
): Promise<AgentResult> {
	const { pdfContent, targetPageNumber, fillData, fieldConfig, checkboxData, sectionMarker, debug } = context;

	let currentPdfBuffer = pdfBuffer;
	let positions: Record<string, Position | null> = {};
	let iteration = 0;
	let llmCalls = 0;
	let corrections = 0;
	let checkboxesPlaced = 0;
	const issues: string[] = [];

	if (debug) {
		console.log('\n🤖 ═══════════════════════════════════════════');
		console.log('   AGENT REACT PDF v1.1 (avec Checkboxes)');
		console.log('   ═══════════════════════════════════════════');
	}

	// ========================================
	// PHASE 1: REASON - Analyser le document
	// ========================================

	if (debug) {
		console.log('\n📊 PHASE REASON: Analyse du document...');
	}

	// Détecter le type de document et la section
	const docType = detectDocumentType(pdfContent);
	const sectionBounds = findSectionBounds(pdfContent, sectionMarker, docType);

	if (debug) {
		console.log(`   Type document: ${docType || 'inconnu'}`);
		if (sectionBounds) {
			console.log(`   Section trouvée: Page ${sectionBounds.startPage}`);
		}
	}

	// Extraire les paragraphes/lignes disponibles pour le LLM
	const availableLines = extractAvailableLines(pdfContent, sectionBounds, targetPageNumber);

	if (debug) {
		console.log(`   Lignes disponibles: ${availableLines.length}`);
	}

	// ========================================
	// PHASE 2: BOUCLE REACT
	// ========================================

	while (iteration < MAX_ITERATIONS) {
		iteration++;

		if (debug) {
			console.log(`\n🔄 ─── Itération ${iteration}/${MAX_ITERATIONS} ───`);
		}

		// Identifier les champs manquants
		const missingFields = Object.entries(fillData)
			.filter(([tag, value]) => value && (!positions[tag] || positions[tag] === null))
			.map(([tag]) => tag);

		if (missingFields.length === 0) {
			if (debug) {
				console.log('   ✅ Tous les champs ont une position');
			}
			break;
		}

		// -----------------------------------------
		// ACT: Appeler le LLM
		// -----------------------------------------

		if (debug) {
			console.log(`\n   🤖 Appel LLM pour ${missingFields.length} champs...`);
		}

		const prompt = buildPdfPrompt(
			missingFields,
			fieldConfig,
			availableLines,
			docType,
			sectionBounds
		);

		try {
			const response = await callLLM(model, prompt);
			llmCalls++;

			const llmPositions = parseLLMPositions(response, fieldConfig);

			if (debug) {
				console.log(`   Positions reçues: ${Object.keys(llmPositions).length}`);
			}

			// Fusionner avec les positions existantes
			for (const [tag, pos] of Object.entries(llmPositions)) {
				if (pos && !positions[tag]) {
					positions[tag] = pos;
				}
			}
		} catch (error) {
			issues.push(`Erreur LLM: ${(error as Error).message}`);
			if (debug) {
				console.log(`   ❌ Erreur LLM: ${(error as Error).message}`);
			}
		}

		// Fallback: détection heuristique pour les champs manquants
		const stillMissing = Object.entries(fillData)
			.filter(([tag, value]) => value && (!positions[tag] || positions[tag] === null))
			.map(([tag]) => tag);

		if (stillMissing.length > 0) {
			if (debug) {
				console.log(`\n   🔧 Fallback heuristique pour ${stillMissing.length} champs...`);
			}

			const heuristicPositions = detectPositionsHeuristic(
				pdfContent,
				stillMissing,
				fieldConfig,
				sectionBounds,
				targetPageNumber
			);

			for (const [tag, pos] of Object.entries(heuristicPositions)) {
				if (pos && !positions[tag]) {
					positions[tag] = pos;
				}
			}
		}

		// -----------------------------------------
		// ACT: Générer le PDF
		// -----------------------------------------

		const matches = buildMatches(positions, fillData, targetPageNumber);
		const fillResult = await fillPdf(currentPdfBuffer, matches, fillData, {
			fontSize: 9,
			debug: false,
		});

		currentPdfBuffer = fillResult.pdfBuffer;

		// -----------------------------------------
		// OBSERVE: Vérifier les placements
		// -----------------------------------------

		if (debug) {
			console.log('\n   🔍 OBSERVE: Vérification des placements...');
		}

		const filledContent = await extractPdfContent(currentPdfBuffer, {
			maxPages: targetPageNumber + 2,
			extractFields: false,
			debug: false,
		});

		const observations = observePlacements(filledContent, positions, fillData);

		// Collecter les champs avec erreurs pour le prompt de correction
		const fieldsToCorrect: Array<{ tag: string; currentPosition: Position; issue: string }> = [];

		for (const [tag, obs] of Object.entries(observations)) {
			if (obs.status === 'collision' || obs.status === 'missing') {
				if (positions[tag]) {
					fieldsToCorrect.push({
						tag,
						currentPosition: positions[tag]!,
						issue: obs.issues.join(', ') || 'Collision avec du texte existant',
					});
				}
				if (debug) {
					console.log(`   ⚠️ ${tag}: ${obs.status} - ${obs.issues.join(', ')}`);
				}
			} else if (obs.status === 'ok' && debug) {
				console.log(`   ✅ ${tag}: OK`);
			}
		}

		if (fieldsToCorrect.length === 0) {
			if (debug) {
				console.log('   ✅ Tous les placements sont corrects');
			}
			break;
		}

		// -----------------------------------------
		// CORRECT: Appeler le LLM avec feedback
		// -----------------------------------------

		if (debug) {
			console.log(`\n   🔧 CORRECT: ${fieldsToCorrect.length} champ(s) à corriger via LLM...`);
		}

		const correctionPrompt = buildCorrectionPrompt(
			fieldsToCorrect,
			fieldConfig,
			availableLines,
			positions
		);

		try {
			const correctionResponse = await callLLM(model, correctionPrompt);
			llmCalls++;
			corrections++;

			const correctedPositions = parseLLMPositions(correctionResponse, fieldConfig);

			if (debug) {
				console.log(`   Corrections reçues: ${Object.keys(correctedPositions).length}`);
			}

			// Appliquer les corrections
			for (const [tag, pos] of Object.entries(correctedPositions)) {
				if (pos) {
					const oldPos = positions[tag];
					positions[tag] = pos;
					if (debug && oldPos) {
						console.log(`   📍 ${tag}: (${oldPos.x}, ${oldPos.y}) → (${pos.x}, ${pos.y})`);
					}
				}
			}
		} catch (error) {
			issues.push(`Erreur correction LLM: ${(error as Error).message}`);
			if (debug) {
				console.log(`   ❌ Erreur correction LLM: ${(error as Error).message}`);
			}
			// Fallback: correction simple par décalage
			for (const field of fieldsToCorrect) {
				if (positions[field.tag]) {
					positions[field.tag]!.y -= 18;
					if (debug) {
						console.log(`   🔧 Fallback: ${field.tag} décalé à y=${positions[field.tag]!.y}`);
					}
				}
			}
		}
	}

	// ========================================
	// PHASE 3: TRAITEMENT DES CHECKBOXES
	// ========================================

	if (checkboxData && Object.keys(checkboxData).length > 0) {
		const checkboxesToFill = Object.entries(checkboxData)
			.filter(([, value]) => value === true)
			.map(([tag]) => tag);

		if (checkboxesToFill.length > 0 && debug) {
			console.log(`\n☑️ Traitement de ${checkboxesToFill.length} checkbox(es)...`);
		}

		// Détecter les positions des checkboxes et les remplir
		const checkboxResult = await fillCheckboxes(
			currentPdfBuffer,
			pdfContent,
			checkboxData,
			fieldConfig,
			targetPageNumber,
			debug
		);

		currentPdfBuffer = checkboxResult.pdfBuffer;
		checkboxesPlaced = checkboxResult.filled;

		if (checkboxResult.issues.length > 0) {
			issues.push(...checkboxResult.issues);
		}

		if (debug) {
			console.log(`   ✅ ${checkboxesPlaced} checkbox(es) cochée(s)`);
		}
	}

	// ========================================
	// PHASE 4: RÉSULTAT FINAL
	// ========================================

	const verified = Object.entries(positions).filter(([tag, pos]) => pos && fillData[tag]).length;
	const totalText = Object.keys(fillData).filter(k => fillData[k]).length;
	const totalCheckboxes = checkboxData ? Object.keys(checkboxData).filter(k => checkboxData[k] === true).length : 0;
	const total = totalText + totalCheckboxes;
	const totalPlaced = verified + checkboxesPlaced;
	const satisfaction = Math.round((totalPlaced / Math.max(total, 1)) * 100);

	if (debug) {
		console.log('\n📊 ═══════════════════════════════════════════');
		console.log('   RÉSULTAT FINAL');
		console.log('   ═══════════════════════════════════════════');
		console.log(`   Itérations: ${iteration}`);
		console.log(`   Appels LLM: ${llmCalls}`);
		console.log(`   Corrections: ${corrections}`);
		console.log(`   Champs texte vérifiés: ${verified}/${totalText}`);
		console.log(`   Checkboxes cochées: ${checkboxesPlaced}/${totalCheckboxes}`);
		console.log(`   Satisfaction: ${satisfaction}%`);
	}

	return {
		success: satisfaction >= SATISFACTION_THRESHOLD,
		pdfBuffer: currentPdfBuffer,
		positions,
		iterations: iteration,
		satisfaction,
		llmCalls,
		corrections,
		verified,
		checkboxesPlaced,
		issues,
	};
}

// ============================================================================
// FONCTIONS HELPER
// ============================================================================

/**
 * Détecte le type de document (DC1 ou DC2)
 */
function detectDocumentType(
	content: Awaited<ReturnType<typeof extractPdfContent>>
): 'DC1' | 'DC2' | null {
	for (const page of content.pages) {
		for (const line of page.lines) {
			if (line.text.includes('D-Présentation du candidat') || line.text.includes('D - Présentation')) {
				return 'DC1';
			}
			if (line.text.includes('C-Identification du candidat') || line.text.includes('C - Identification')) {
				return 'DC2';
			}
		}
	}
	return null;
}

/**
 * Trouve les limites de la section à analyser
 */
function findSectionBounds(
	content: Awaited<ReturnType<typeof extractPdfContent>>,
	customMarker?: string,
	docType?: 'DC1' | 'DC2' | null
): { startPage: number; startY: number; endPage: number } | null {
	const markers = [
		customMarker,
		docType === 'DC1' ? 'D-Présentation du candidat' : null,
		docType === 'DC2' ? 'C-Identification du candidat' : null,
	].filter(Boolean) as string[];

	for (const marker of markers) {
		const normalizedMarker = marker.replace(/\s+/g, '').toLowerCase();

		for (const page of content.pages) {
			for (const line of page.lines) {
				const normalizedLine = line.text.replace(/\s+/g, '').toLowerCase();
				if (normalizedLine.includes(normalizedMarker) || line.text.includes(marker)) {
					return {
						startPage: page.pageNumber,
						startY: line.y,
						endPage: page.pageNumber + 1,
					};
				}
			}
		}
	}
	return null;
}

/**
 * Extrait les lignes disponibles pour l'analyse
 */
function extractAvailableLines(
	content: Awaited<ReturnType<typeof extractPdfContent>>,
	sectionBounds: { startPage: number; startY: number; endPage: number } | null,
	targetPage: number
): Array<{ page: number; y: number; text: string; hasColon: boolean }> {
	const lines: Array<{ page: number; y: number; text: string; hasColon: boolean }> = [];

	const pagesToAnalyze = content.pages.filter(p => {
		if (sectionBounds) {
			return p.pageNumber >= sectionBounds.startPage && p.pageNumber <= sectionBounds.endPage;
		}
		return p.pageNumber === targetPage || p.pageNumber === targetPage + 1;
	});

	for (const page of pagesToAnalyze) {
		const sortedLines = [...page.lines].sort((a, b) => b.y - a.y);

		for (const line of sortedLines) {
			// Filtrer les lignes dans la section si on a des limites
			if (sectionBounds && page.pageNumber === sectionBounds.startPage) {
				if (line.y >= sectionBounds.startY) continue;
			}

			lines.push({
				page: page.pageNumber,
				y: Math.round(line.y),
				text: line.text.substring(0, 80),
				hasColon: line.text.includes(':'),
			});
		}
	}

	return lines;
}

/**
 * Construit le prompt pour le LLM
 */
function buildPdfPrompt(
	missingFields: string[],
	fieldConfig: Record<string, FieldConfig>,
	availableLines: Array<{ page: number; y: number; text: string; hasColon: boolean }>,
	docType: 'DC1' | 'DC2' | null,
	sectionBounds: { startPage: number; startY: number; endPage: number } | null
): string {
	let prompt = `# AGENT PDF MAPPING

## CONTEXTE
- Type document: ${docType || 'Document PDF standard'}
- Section: ${sectionBounds ? `Page ${sectionBounds.startPage}` : 'Document complet'}
- Champs à placer: ${missingFields.length}

## CHAMPS À PLACER

`;

	for (const field of missingFields) {
		const config = fieldConfig[field];
		if (config) {
			prompt += `### {{${field}}}
- Labels à chercher: ${config.labels.join(', ')}
- Type: ${config.type}
- Placement: ${config.type === 'inline' ? 'après le ":" sur la même ligne' : 'dans le gap sous le label'}

`;
		}
	}

	prompt += `## LIGNES DISPONIBLES DANS LE PDF

\`\`\`json
${JSON.stringify(availableLines.slice(0, 50), null, 2)}
\`\`\`

## INSTRUCTIONS

1. Pour chaque champ, trouve la ligne qui contient le label correspondant
2. Pour les champs INLINE (EMAIL, TELEPHONE): place après le ":" sur la MÊME ligne (y identique)
3. Pour les champs MULTILINE (NOM_COMMERCIAL, ADRESSE, SIRET): place dans le GAP sous le label (y plus petit de ~20-40 pts)
4. Retourne les positions exactes (page, x, y)

## FORMAT DE RÉPONSE (JSON STRICT)

\`\`\`json
{
  "positions": [
    {"tag": "NOM_COMMERCIAL", "page": 1, "x": 71, "y": 650, "type": "multiline", "confidence": 0.9},
    {"tag": "EMAIL", "page": 2, "x": 180, "y": 798, "type": "inline", "confidence": 0.95}
  ]
}
\`\`\`

RÉPONDS UNIQUEMENT AVEC LE JSON.`;

	return prompt;
}

/**
 * Construit un prompt de CORRECTION avec feedback des erreurs
 */
function buildCorrectionPrompt(
	fieldsToCorrect: Array<{ tag: string; currentPosition: Position; issue: string }>,
	fieldConfig: Record<string, FieldConfig>,
	availableLines: Array<{ page: number; y: number; text: string; hasColon: boolean }>,
	previousPositions: Record<string, Position | null>
): string {
	let prompt = `# AGENT PDF MAPPING - MODE CORRECTION

## PROBLÈME DÉTECTÉ
Tu as placé des champs qui causent des collisions ou des erreurs de positionnement.
Analyse les erreurs ci-dessous et propose de NOUVELLES positions corrigées.

## ERREURS À CORRIGER

`;

	for (const field of fieldsToCorrect) {
		const config = fieldConfig[field.tag];
		prompt += `### {{${field.tag}}}
- Position actuelle: page=${field.currentPosition.page}, x=${field.currentPosition.x}, y=${field.currentPosition.y}
- Problème: ${field.issue}
- Type attendu: ${config?.type || 'text'}
- Labels: ${config?.labels?.join(', ') || field.tag}
- Action requise: Trouve une NOUVELLE position qui évite ce problème

`;
	}

	prompt += `## POSITIONS DÉJÀ VALIDÉES (NE PAS MODIFIER)

`;
	for (const [tag, pos] of Object.entries(previousPositions)) {
		if (pos && !fieldsToCorrect.find(f => f.tag === tag)) {
			prompt += `- {{${tag}}}: page=${pos.page}, x=${pos.x}, y=${pos.y} ✓
`;
		}
	}

	prompt += `
## LIGNES DISPONIBLES DANS LE PDF

\`\`\`json
${JSON.stringify(availableLines.slice(0, 50), null, 2)}
\`\`\`

## RÈGLES DE CORRECTION

1. Pour éviter une COLLISION: déplace le champ vers un espace vide (gap) plus bas ou plus haut
2. Pour un champ INLINE mal placé: assure-toi qu'il est SUR LA MÊME LIGNE que le label (même Y)
3. Pour un champ MULTILINE mal placé: trouve un GAP (espace vide de 20-40 pts) sous le label
4. NE JAMAIS placer sur une ligne qui contient déjà du texte

## FORMAT DE RÉPONSE (JSON STRICT)

\`\`\`json
{
  "reasoning": "Explication de ta correction",
  "positions": [
    {"tag": "NOM_CHAMP", "page": 1, "x": 71, "y": 620, "type": "multiline", "confidence": 0.85}
  ]
}
\`\`\`

RÉPONDS UNIQUEMENT AVEC LE JSON.`;

	return prompt;
}

/**
 * Appelle le LLM connecté
 */
async function callLLM(model: LLMModel, prompt: string): Promise<string> {
	const response = await model.invoke(prompt);

	if (typeof response === 'string') {
		return response;
	}

	if (response && typeof response === 'object') {
		if ('content' in response) {
			return String(response.content);
		}
		if ('text' in response) {
			return String((response as { text: string }).text);
		}
		return JSON.stringify(response);
	}

	return '';
}

/**
 * Parse les positions retournées par le LLM
 */
function parseLLMPositions(
	response: string,
	_fieldConfig: Record<string, FieldConfig>
): Record<string, Position | null> {
	const positions: Record<string, Position | null> = {};

	if (!response) return positions;

	// Extraire le JSON
	let json: string | null = null;

	const markdownMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
	if (markdownMatch) {
		json = markdownMatch[1].trim();
	}

	if (!json) {
		const jsonStart = response.indexOf('{');
		const jsonEnd = response.lastIndexOf('}');
		if (jsonStart !== -1 && jsonEnd > jsonStart) {
			json = response.substring(jsonStart, jsonEnd + 1);
		}
	}

	if (!json) return positions;

	try {
		const parsed = JSON.parse(json);
		const positionsList = parsed.positions || [];

		for (const item of positionsList) {
			if (!item.tag || typeof item.tag !== 'string') continue;
			if (typeof item.page !== 'number' || typeof item.y !== 'number') continue;

			positions[item.tag] = {
				page: item.page,
				x: item.x || 71,
				y: item.y,
				type: item.type === 'inline' ? 'inline' : 'multiline',
				confidence: item.confidence || 0.8,
			};
		}
	} catch (error) {
		console.error('Erreur parsing JSON LLM:', (error as Error).message);
	}

	return positions;
}

/**
 * Détection heuristique des positions (fallback)
 */
function detectPositionsHeuristic(
	content: Awaited<ReturnType<typeof extractPdfContent>>,
	missingFields: string[],
	fieldConfig: Record<string, FieldConfig>,
	sectionBounds: { startPage: number; startY: number; endPage: number } | null,
	targetPage: number
): Record<string, Position | null> {
	const positions: Record<string, Position | null> = {};

	const pagesToAnalyze = content.pages.filter(p => {
		if (sectionBounds) {
			return p.pageNumber >= sectionBounds.startPage && p.pageNumber <= sectionBounds.endPage;
		}
		return p.pageNumber === targetPage || p.pageNumber === targetPage + 1;
	});

	for (const field of missingFields) {
		const config = fieldConfig[field];
		if (!config) continue;

		let bestMatch: Position | null = null;

		for (const page of pagesToAnalyze) {
			const sortedLines = [...page.lines].sort((a, b) => b.y - a.y);

			// Filtrer selon la section
			const linesInSection = sectionBounds && page.pageNumber === sectionBounds.startPage
				? sortedLines.filter(l => l.y < sectionBounds.startY)
				: sortedLines;

			// Chercher le label
			const occurrences: { index: number; line: typeof linesInSection[0] }[] = [];
			for (let i = 0; i < linesInSection.length; i++) {
				const matchedLabel = config.labels.find(lbl => linesInSection[i].text.includes(lbl));
				if (matchedLabel) {
					occurrences.push({ index: i, line: linesInSection[i] });
				}
			}

			if (occurrences.length === 0) continue;

			if (config.type === 'inline') {
				// Chercher le ":" et placer après
				const firstOcc = occurrences[0];
				const lineElements = page.textElements.filter(el =>
					Math.abs(el.y - firstOcc.line.y) < 5
				).sort((a, b) => a.x - b.x);

				for (const el of lineElements) {
					if (el.text.includes(':')) {
						const colonIdx = el.text.indexOf(':');
						const charWidth = el.width / Math.max(el.text.length, 1);
						const x = el.x + (colonIdx + 1) * charWidth + 8;

						bestMatch = {
							page: page.pageNumber,
							x: Math.round(x),
							y: Math.round(el.y),
							type: 'inline',
						};
						break;
					}
				}
			} else {
				// Chercher le gap après le label
				for (const occ of occurrences) {
					if (bestMatch) break;
					const i = occ.index;
					if (i + 1 >= linesInSection.length) continue;

					let endIndex = i;
					for (let j = i + 1; j < Math.min(i + 6, linesInSection.length); j++) {
						const lineGap = linesInSection[j - 1].y - linesInSection[j].y;
						if (lineGap < 18) {
							endIndex = j;
						} else {
							break;
						}
					}

					if (endIndex + 1 < linesInSection.length) {
						const labelEndLine = linesInSection[endIndex];
						const nextLine = linesInSection[endIndex + 1];
						const gap = labelEndLine.y - nextLine.y;
						const minGap = config.minGap ?? 0;

						if (gap >= minGap) {
							const inputY = nextLine.y + (gap / 2);
							const hasTextAtY = page.textElements.some(el =>
								Math.abs(el.y - inputY) < 10 && el.text.trim().length > 0
							);

							if (!hasTextAtY) {
								bestMatch = {
									page: page.pageNumber,
									x: 71,
									y: Math.round(inputY),
									type: 'multiline',
								};
							}
						}
					}
				}
			}

			if (bestMatch) break;
		}

		positions[field] = bestMatch;
	}

	return positions;
}

/**
 * Construit les matches pour fillPdf
 */
function buildMatches(
	positions: Record<string, Position | null>,
	fillData: Record<string, string>,
	targetPageNumber: number
): Parameters<typeof fillPdf>[1] {
	const matches: Parameters<typeof fillPdf>[1] = [];

	for (const [tag, pos] of Object.entries(positions)) {
		if (!pos || !fillData[tag]) continue;

		matches.push({
			tag,
			targetField: {
				id: `field_${tag}`,
				label: tag,
				labelPosition: { x: pos.x, y: pos.y, width: 100, height: 12, page: pos.page },
				inputZone: { x: pos.x, y: pos.y, width: 300, height: 12, page: pos.page },
				fieldType: 'text',
				confidence: pos.confidence || 0.95,
			},
			confidence: pos.confidence || 0.95,
			reason: 'ReAct Agent LLM',
			placementPosition: { x: pos.x, y: pos.y, page: pos.page },
		});
	}

	return matches;
}

/**
 * Observe les placements dans le PDF rempli
 */
function observePlacements(
	filledContent: Awaited<ReturnType<typeof extractPdfContent>>,
	positions: Record<string, Position | null>,
	fillData: Record<string, string>
): Record<string, { status: 'ok' | 'collision' | 'missing'; issues: string[] }> {
	const observations: Record<string, { status: 'ok' | 'collision' | 'missing'; issues: string[] }> = {};

	for (const [tag, pos] of Object.entries(positions)) {
		if (!pos || !fillData[tag]) {
			observations[tag] = { status: 'missing', issues: ['Pas de position ou valeur'] };
			continue;
		}

		observations[tag] = { status: 'ok', issues: [] };

		const value = fillData[tag];

		// Chercher la valeur dans le PDF rempli
		for (const page of filledContent.pages) {
			for (const line of page.lines) {
				if (line.text.includes(value.substring(0, 12))) {
					// Vérifier si bien placé
					if (pos.type === 'inline') {
						const isAfterColon = line.text.includes(': ' + value.substring(0, 8)) ||
							line.text.includes(':' + value.substring(0, 8));
						if (!isAfterColon) {
							observations[tag] = { status: 'collision', issues: ['Pas après ":"'] };
						}
					} else {
						const isAlone = line.text.trim() === value || line.text.trim().startsWith(value);
						if (!isAlone) {
							observations[tag] = { status: 'collision', issues: ['Pas isolé'] };
						}
					}
					break;
				}
			}
		}
	}

	return observations;
}
