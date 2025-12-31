/**
 * ============================================================================
 * TEST AGENT REACT - Test du nouvel agent autonome
 * ============================================================================
 *
 * Ce script teste l'agent ReAct avec le document 25_NOMOS_DC2.docx
 *
 * Usage:
 *   node test-react-agent.js
 *
 * Prérequis:
 *   - npm run build (compilation TypeScript)
 *   - Documents dans ~/Downloads/
 *
 * @author Rokodo
 */

const fs = require('fs');
const path = require('path');

// Import des services compilés
const { loadDocxContent, saveDocxContent } = require('./dist/shared/utils/docx.utils');
const { extractTagContextsFromTemplate, extractTagsFromTemplateXml } = require('./dist/shared/utils/docx.utils');
const { extractTargetParagraphs, enrichParagraphsWithTableInfo } = require('./dist/shared/utils/docx.utils');
const { detectDocumentType } = require('./dist/shared/utils/docx.utils');
const { extractCheckboxes, findCheckboxPairs } = require('./dist/shared/utils/checkbox.utils');
const { runReActAgent } = require('./dist/TemplateMapper/services/react-agent.service');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
	// Document cible (à taguer)
	targetPath: path.join(process.env.HOME, 'Downloads', '25_NOMOS_DC2.docx'),
	// Template de référence (avec tags)
	templatePath: path.join(process.env.HOME, 'Downloads', 'template_dc2.docx'),
	// Fichier de sortie
	outputPath: path.join(process.env.HOME, 'Downloads', '25_NOMOS_DC2_REACT_AGENT.docx'),
	// Mode debug
	debug: true,
};

// ============================================================================
// MOCK LLM (pour test sans API)
// ============================================================================

/**
 * Mock LLM qui simule des réponses intelligentes basées sur le prompt.
 * Utilisé pour tester l'agent sans appeler une vraie API.
 */
class MockLLM {
	constructor() {
		this.callCount = 0;
	}

	async invoke(prompt) {
		this.callCount++;
		console.log(`\n   [MockLLM] Appel #${this.callCount}`);

		// Extraire les tags à placer depuis le prompt
		const tagsToPlace = this.extractTagsFromPrompt(prompt);
		const paragraphs = this.extractParagraphsFromPrompt(prompt);

		console.log(`   [MockLLM] Tags demandés: ${tagsToPlace.length}`);
		console.log(`   [MockLLM] Paragraphes disponibles: ${paragraphs.length}`);

		// Générer des placements intelligents
		const placements = this.generatePlacements(tagsToPlace, paragraphs);

		console.log(`   [MockLLM] Placements générés: ${placements.length}`);

		return JSON.stringify({ placements });
	}

	extractTagsFromPrompt(prompt) {
		const tags = [];
		// Chercher les patterns {{TAG}} → position
		const regex = /\*\*\{\{([A-Z_0-9]+)\}\}\*\*\s*→\s*([^\n]+)/g;
		let match;
		while ((match = regex.exec(prompt)) !== null) {
			const tag = match[1];
			const location = match[2];

			// Parser la position de tableau si présente
			const tableMatch = location.match(/Table(\d+)\s*Ligne(\d+)\s*Colonne(\d+)/);
			if (tableMatch) {
				tags.push({
					tag,
					type: 'table_cell',
					tableIndex: parseInt(tableMatch[1]),
					rowIndex: parseInt(tableMatch[2]),
					columnIndex: parseInt(tableMatch[3]),
				});
			} else {
				// Tag de texte
				const nearMatch = location.match(/près de:\s*"([^"]+)"/);
				tags.push({
					tag,
					type: 'text',
					nearText: nearMatch ? nearMatch[1] : '',
				});
			}
		}
		return tags;
	}

	extractParagraphsFromPrompt(prompt) {
		const paragraphs = [];
		// Chercher le JSON des paragraphes
		const jsonMatch = prompt.match(/```json\n(\[[\s\S]*?\])\n```/);
		if (jsonMatch) {
			try {
				const parsed = JSON.parse(jsonMatch[1]);
				return parsed;
			} catch (e) {
				console.log('   [MockLLM] Erreur parsing JSON paragraphes');
			}
		}
		return paragraphs;
	}

	generatePlacements(tags, paragraphs) {
		const placements = [];
		const usedIdx = new Set();

		for (const tag of tags) {
			let bestMatch = null;
			let bestScore = 0;

			for (const p of paragraphs) {
				if (usedIdx.has(p.idx)) continue;

				let score = 0;

				// Score pour match de tableau
				if (tag.type === 'table_cell' && p.pos) {
					const posMatch = p.pos.match(/T(\d+)R(\d+)C(\d+)/);
					if (posMatch) {
						const [, t, r, c] = posMatch.map(Number);
						if (t === tag.tableIndex && r === tag.rowIndex && c === tag.columnIndex) {
							score = 100; // Match parfait
						}
					}
				}

				// Score pour match de texte
				if (tag.type === 'text' && tag.nearText) {
					const keywords = tag.nearText.toLowerCase().split(/\s+/).filter(w => w.length >= 3);
					const textLower = (p.text || '').toLowerCase();
					for (const kw of keywords) {
						if (textLower.includes(kw)) {
							score += kw.length;
						}
					}
				}

				// Bonus pour cellule vide
				if (p.empty && tag.type === 'table_cell') {
					score += 10;
				}

				// Bonus pour texte finissant par ":"
				if ((p.text || '').trim().endsWith(':')) {
					score += 5;
				}

				if (score > bestScore) {
					bestScore = score;
					bestMatch = p;
				}
			}

			if (bestMatch && bestScore >= 5) {
				placements.push({
					tag: tag.tag,
					targetIdx: bestMatch.idx,
					confidence: Math.min(0.95, 0.7 + bestScore / 100),
					insertionPoint: bestMatch.isCell ? 'table_cell' : 'after_colon',
					reason: `Score: ${bestScore}`,
				});
				usedIdx.add(bestMatch.idx);
			}
		}

		return placements;
	}
}

// ============================================================================
// FONCTION PRINCIPALE
// ============================================================================

async function main() {
	console.log('============================================================');
	console.log('  TEST AGENT REACT AUTONOME');
	console.log('============================================================\n');

	// Vérifier les fichiers
	if (!fs.existsSync(CONFIG.targetPath)) {
		console.error(`❌ Document cible non trouvé: ${CONFIG.targetPath}`);
		process.exit(1);
	}
	if (!fs.existsSync(CONFIG.templatePath)) {
		console.error(`❌ Template non trouvé: ${CONFIG.templatePath}`);
		process.exit(1);
	}

	console.log('📄 Documents:');
	console.log(`   Cible: ${path.basename(CONFIG.targetPath)}`);
	console.log(`   Template: ${path.basename(CONFIG.templatePath)}`);
	console.log(`   Sortie: ${path.basename(CONFIG.outputPath)}`);

	// ========================================
	// ÉTAPE 1: Charger les documents
	// ========================================

	console.log('\n📂 Chargement des documents...');

	const targetBuffer = fs.readFileSync(CONFIG.targetPath);
	const templateBuffer = fs.readFileSync(CONFIG.templatePath);

	const targetDoc = loadDocxContent(targetBuffer);
	const templateDoc = loadDocxContent(templateBuffer);

	console.log(`   ✓ Document cible chargé`);
	console.log(`   ✓ Template chargé`);

	// ========================================
	// ÉTAPE 2: Extraire les informations
	// ========================================

	console.log('\n🔍 Extraction des informations...');

	// Tags du template
	const extractedTags = extractTagsFromTemplateXml(templateDoc.xml);
	const tagContexts = extractTagContextsFromTemplate(templateDoc.xml);

	console.log(`   Tags dans le template: ${extractedTags.length}`);
	console.log(`   Contextes de tags: ${tagContexts.length}`);

	// Afficher quelques tags
	console.log('\n   Tags extraits:');
	extractedTags.slice(0, 10).forEach(t => {
		console.log(`      - {{${t.tag}}} (${t.type})`);
	});
	if (extractedTags.length > 10) {
		console.log(`      ... et ${extractedTags.length - 10} autres`);
	}

	// Checkboxes
	const templateCheckboxes = extractCheckboxes(templateDoc.xml);
	const templateCheckboxPairs = findCheckboxPairs(templateCheckboxes);

	console.log(`\n   Checkboxes template: ${templateCheckboxes.length}`);
	console.log(`   Paires Oui/Non: ${templateCheckboxPairs.length}`);

	// Document cible
	const docType = detectDocumentType(targetDoc.xml, path.basename(CONFIG.targetPath));
	const baseParagraphs = extractTargetParagraphs(targetDoc.xml);
	const targetParagraphs = enrichParagraphsWithTableInfo(targetDoc.xml, baseParagraphs);
	const targetCheckboxes = extractCheckboxes(targetDoc.xml);

	console.log(`\n   Type document: ${docType.type}`);
	console.log(`   Paragraphes cible: ${targetParagraphs.length}`);
	console.log(`   Checkboxes cible: ${targetCheckboxes.length}`);

	// Afficher les paragraphes de tableau
	const tableParagraphs = targetParagraphs.filter(p => p.isTableCell);
	console.log(`\n   Cellules de tableau: ${tableParagraphs.length}`);

	// Afficher quelques cellules vides (candidats pour tags)
	const emptyCells = tableParagraphs.filter(p => p.text.trim().length < 3);
	console.log(`   Cellules vides: ${emptyCells.length}`);
	emptyCells.slice(0, 5).forEach(p => {
		console.log(`      - idx=${p.index} T${p.tableIndex}R${p.rowIndex}C${p.columnIndex}`);
	});

	// ========================================
	// ÉTAPE 3: Créer le contexte de mapping
	// ========================================

	console.log('\n🔧 Création du contexte de mapping...');

	const mappingContext = {
		tagContexts,
		extractedTags,
		templateCheckboxes,
		templateCheckboxPairs,
		targetParagraphs,
		targetCheckboxes,
		targetXml: targetDoc.xml,
		docType: docType.type,
		debug: CONFIG.debug,
	};

	// ========================================
	// ÉTAPE 4: Lancer l'agent ReAct
	// ========================================

	console.log('\n🤖 Lancement de l\'agent ReAct...');

	// Utiliser le MockLLM pour le test
	const mockLLM = new MockLLM();

	const startTime = Date.now();
	const result = await runReActAgent(mockLLM, mappingContext);
	const duration = Date.now() - startTime;

	// ========================================
	// ÉTAPE 5: Afficher les résultats
	// ========================================

	console.log('\n\n============================================================');
	console.log('  RÉSULTATS DE L\'AGENT REACT');
	console.log('============================================================');

	console.log(`\n📊 Statistiques:`);
	console.log(`   Succès: ${result.success ? '✅ OUI' : '❌ NON'}`);
	console.log(`   Itérations: ${result.iterations}`);
	console.log(`   Satisfaction: ${result.satisfaction}%`);
	console.log(`   Durée: ${duration}ms`);

	console.log(`\n🏷️ Tags:`);
	console.log(`   Attendus: ${result.tagsExpected}`);
	console.log(`   Vérifiés: ${result.tagsVerified}`);
	console.log(`   Échecs: ${result.tagsFailed}`);

	// Afficher les tags par statut
	const verifiedTags = result.state.expectedTags.filter(t => t.status === 'verified');
	const placedTags = result.state.expectedTags.filter(t => t.status === 'placed');
	const pendingTags = result.state.expectedTags.filter(t => t.status === 'pending');
	const failedTags = result.state.expectedTags.filter(t => t.status === 'failed');

	if (verifiedTags.length > 0) {
		console.log(`\n   ✅ Tags vérifiés (${verifiedTags.length}):`);
		verifiedTags.slice(0, 10).forEach(t => {
			const loc = t.expectedLocation;
			const pos = loc.tableIndex !== undefined
				? `T${loc.tableIndex}R${loc.rowIndex}C${loc.columnIndex}`
				: 'texte';
			console.log(`      - {{${t.tag}}} → ${pos}`);
		});
	}

	if (placedTags.length > 0) {
		console.log(`\n   📍 Tags placés mais non vérifiés (${placedTags.length}):`);
		placedTags.slice(0, 5).forEach(t => console.log(`      - {{${t.tag}}}`));
	}

	if (pendingTags.length > 0) {
		console.log(`\n   ⏳ Tags en attente (${pendingTags.length}):`);
		pendingTags.slice(0, 5).forEach(t => console.log(`      - {{${t.tag}}}`));
	}

	if (failedTags.length > 0) {
		console.log(`\n   ❌ Tags échoués (${failedTags.length}):`);
		failedTags.slice(0, 5).forEach(t => console.log(`      - {{${t.tag}}}`));
	}

	// Issues
	if (result.state.issues.length > 0) {
		console.log(`\n⚠️ Issues détectées (${result.state.issues.length}):`);
		result.state.issues.slice(0, 10).forEach(i => {
			const icon = i.severity === 'critical' ? '🔴' : i.severity === 'warning' ? '🟡' : '🔵';
			console.log(`   ${icon} [${i.type}] ${i.description}`);
		});
	}

	// Actions
	console.log(`\n📜 Historique des actions (${result.state.actions.length}):`);
	result.state.actions.forEach(a => {
		const status = a.result === 'success' ? '✓' : a.result === 'partial' ? '~' : '✗';
		console.log(`   ${status} [It.${a.iteration}] ${a.type}: ${JSON.stringify(a.details)}`);
	});

	// ========================================
	// ÉTAPE 6: Sauvegarder le document
	// ========================================

	console.log('\n💾 Sauvegarde du document...');

	const outputBuffer = saveDocxContent(targetDoc.zip, result.xml);
	fs.writeFileSync(CONFIG.outputPath, outputBuffer);

	console.log(`   ✓ Document sauvegardé: ${CONFIG.outputPath}`);

	// Vérification finale
	console.log('\n🔍 Vérification du document de sortie...');

	const outputDoc = loadDocxContent(outputBuffer);
	const tagsInOutput = (outputDoc.xml.match(/\{\{[A-Z_0-9]+\}\}/g) || []);
	const uniqueTagsInOutput = [...new Set(tagsInOutput.map(t => t.replace(/[{}]/g, '')))];

	console.log(`   Tags dans le document de sortie: ${uniqueTagsInOutput.length}`);
	uniqueTagsInOutput.slice(0, 15).forEach(t => console.log(`      - {{${t}}}`));
	if (uniqueTagsInOutput.length > 15) {
		console.log(`      ... et ${uniqueTagsInOutput.length - 15} autres`);
	}

	console.log('\n============================================================');
	console.log('  TEST TERMINÉ');
	console.log('============================================================\n');
}

// Lancer le test
main().catch(error => {
	console.error('\n❌ Erreur:', error.message);
	console.error(error.stack);
	process.exit(1);
});
