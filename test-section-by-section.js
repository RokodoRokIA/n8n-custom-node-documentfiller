/**
 * Test Script - Traitement Section par Section v4.3
 *
 * Ce script teste la nouvelle architecture de traitement par section
 * sans nécessiter n8n.
 *
 * Usage: node test-section-by-section.js
 */

const fs = require('fs');
const path = require('path');

// Import des modules compilés
const { loadDocxContent, extractTagContextsFromTemplate, extractTargetParagraphs, enrichParagraphsWithTableInfo } = require('./dist/shared/utils/docx.utils');
const { extractCheckboxesFromXml, detectCheckboxPairs } = require('./dist/shared/utils/checkbox.utils');

// Configuration - Ajustez ces chemins selon votre environnement
const TEMPLATE_PATH = './DC2_with_tags.docx';
const TARGET_PATH = process.argv[2] || '/Users/rodolphebeloncle/Downloads/25_NOMOS_DC2.docx';

console.log('🧪 ════════════════════════════════════════════════════════');
console.log('   TEST: Traitement Section par Section v4.3');
console.log('   ════════════════════════════════════════════════════════\n');

// Vérifier les fichiers
if (!fs.existsSync(TEMPLATE_PATH)) {
	console.error(`❌ Template non trouvé: ${TEMPLATE_PATH}`);
	console.log('   Créez un dossier "templates" avec votre DC2_with_tags.docx');
	process.exit(1);
}

// Créer un mock du LLM pour les tests
function mockLLM(prompt) {
	console.log('\n   📤 PROMPT ENVOYÉ AU LLM:');
	console.log('   ' + '-'.repeat(50));

	// Extraire les infos clés du prompt
	const sectionMatch = prompt.match(/SECTION ([A-Z])/);
	const tagsMatch = prompt.match(/Tags à placer: (\d+)/);
	const paragraphsMatch = prompt.match(/Paragraphes disponibles: (\d+)/);

	console.log(`   Section: ${sectionMatch ? sectionMatch[1] : '?'}`);
	console.log(`   Tags à placer: ${tagsMatch ? tagsMatch[1] : '?'}`);
	console.log(`   Paragraphes: ${paragraphsMatch ? paragraphsMatch[1] : '?'}`);

	// Extraire les tags demandés
	const tagMatches = prompt.match(/\*\*\{\{([A-Z_0-9]+)\}\}\*\*/g) || [];
	const tags = tagMatches.map(t => t.replace(/[*{}]/g, ''));
	console.log(`   Tags: ${tags.join(', ')}`);

	// Extraire les paragraphes JSON
	const jsonMatch = prompt.match(/```json\n([\s\S]*?)\n```/);
	if (jsonMatch) {
		try {
			const paragraphs = JSON.parse(jsonMatch[1]);
			console.log(`\n   📋 PARAGRAPHES DISPONIBLES (${paragraphs.length}):`);

			// Afficher les cellules de tableau vides (candidats principaux)
			const emptyCells = paragraphs.filter(p => p.isCell && p.empty);
			if (emptyCells.length > 0) {
				console.log(`\n   🔲 Cellules vides (${emptyCells.length}):`);
				emptyCells.slice(0, 10).forEach(p => {
					console.log(`      idx=${p.idx} ${p.pos || ''}`);
				});
			}

			// Afficher les paragraphes avec ":"
			const colonParagraphs = paragraphs.filter(p => !p.isCell && p.text && p.text.includes(':'));
			if (colonParagraphs.length > 0) {
				console.log(`\n   📝 Paragraphes avec ":" (${colonParagraphs.length}):`);
				colonParagraphs.slice(0, 10).forEach(p => {
					console.log(`      idx=${p.idx} "${p.text.substring(0, 40)}..."`);
				});
			}

			// Simuler une réponse LLM basique
			const placements = [];

			for (const tag of tags) {
				// Pour les tags de tableau, chercher une cellule vide avec la bonne position
				if (tag.includes('CA_') || tag.includes('PART_')) {
					const cell = emptyCells.find(c => !placements.some(p => p.targetIdx === c.idx));
					if (cell) {
						placements.push({
							tag,
							targetIdx: cell.idx,
							confidence: 0.8,
							insertionPoint: 'table_cell'
						});
					}
				} else {
					// Pour les tags de texte, chercher un paragraphe correspondant
					const keywords = {
						'NOM_COMMERCIAL': ['nom', 'commercial', 'dénomination'],
						'ADRESSE': ['adresse', 'postale', 'siège'],
						'EMAIL': ['électronique', 'courriel', 'email'],
						'TELEPHONE': ['téléphone', 'télécopie'],
						'SIRET': ['siret', 'siren', 'identification']
					};

					const kws = keywords[tag] || [];
					const match = colonParagraphs.find(p => {
						const textLower = p.text.toLowerCase();
						return kws.some(kw => textLower.includes(kw)) &&
							   !placements.some(pl => pl.targetIdx === p.idx);
					});

					if (match) {
						placements.push({
							tag,
							targetIdx: match.idx,
							confidence: 0.85,
							insertionPoint: 'after_colon'
						});
					}
				}
			}

			console.log(`\n   🤖 RÉPONSE LLM SIMULÉE:`);
			console.log(`   Placements: ${placements.length}`);
			placements.forEach(p => {
				console.log(`      {{${p.tag}}} → idx=${p.targetIdx} (${p.insertionPoint})`);
			});

			return JSON.stringify({ placements });

		} catch (e) {
			console.log('   ⚠️ Erreur parsing JSON paragraphes');
		}
	}

	return JSON.stringify({ placements: [] });
}

async function runTest() {
	try {
		// 1. Charger le template
		console.log('📂 Chargement du template...');
		const templateBuffer = fs.readFileSync(TEMPLATE_PATH);
		const { xml: templateXml } = loadDocxContent(templateBuffer);

		// 2. Extraire les contextes de tags du template
		const tagContexts = extractTagContextsFromTemplate(templateXml);
		console.log(`   ✓ ${tagContexts.length} tags extraits du template`);

		// Afficher les tags par section
		const tagsBySection = {};
		for (const ctx of tagContexts) {
			const section = ctx.section || 'UNKNOWN';
			if (!tagsBySection[section]) tagsBySection[section] = [];
			tagsBySection[section].push(ctx.tag);
		}

		console.log('\n📊 Tags par section dans le TEMPLATE:');
		for (const [section, tags] of Object.entries(tagsBySection)) {
			console.log(`   Section ${section}: ${tags.length} tags`);
			tags.slice(0, 5).forEach(t => console.log(`      - {{${t}}}`));
			if (tags.length > 5) console.log(`      ... et ${tags.length - 5} autres`);
		}

		// 3. Charger le document cible (si disponible)
		let targetXml = null;
		let targetParagraphs = [];

		if (fs.existsSync(TARGET_PATH)) {
			console.log('\n📂 Chargement du document cible...');
			const targetBuffer = fs.readFileSync(TARGET_PATH);
			const { xml } = loadDocxContent(targetBuffer);
			targetXml = xml;

			// Extraire les paragraphes
			targetParagraphs = extractTargetParagraphs(targetXml);
			targetParagraphs = enrichParagraphsWithTableInfo(targetXml, targetParagraphs);

			console.log(`   ✓ ${targetParagraphs.length} paragraphes extraits`);

			// Afficher les paragraphes par section
			const paragraphsBySection = {};
			for (const p of targetParagraphs) {
				const section = p.section || 'UNKNOWN';
				if (!paragraphsBySection[section]) paragraphsBySection[section] = [];
				paragraphsBySection[section].push(p);
			}

			console.log('\n📊 Paragraphes par section dans le DOCUMENT CIBLE:');
			for (const [section, paras] of Object.entries(paragraphsBySection)) {
				const tableCells = paras.filter(p => p.isTableCell);
				const emptyCells = tableCells.filter(p => p.text.trim().length < 3);
				console.log(`   Section ${section}: ${paras.length} paragraphes (${tableCells.length} cellules, ${emptyCells.length} vides)`);
			}

		} else {
			console.log(`\n⚠️ Document cible non trouvé: ${TARGET_PATH}`);
			console.log('   Le test continuera avec des données simulées.');
		}

		// 4. Simuler le traitement section par section
		console.log('\n\n🔄 ════════════════════════════════════════════════════════');
		console.log('   SIMULATION DU TRAITEMENT SECTION PAR SECTION');
		console.log('   ════════════════════════════════════════════════════════');

		const sectionsToProcess = Object.keys(tagsBySection).filter(s => s !== 'UNKNOWN');

		for (const section of sectionsToProcess) {
			const sectionTags = tagsBySection[section];

			console.log(`\n\n🔷 ═══════════════════════════════════════════`);
			console.log(`   SECTION ${section}`);
			console.log(`   ═══════════════════════════════════════════`);
			console.log(`   Tags à placer: ${sectionTags.length}`);
			sectionTags.forEach(t => console.log(`      - {{${t}}}`));

			if (targetParagraphs.length > 0) {
				// Filtrer les paragraphes de cette section
				const sectionParagraphs = targetParagraphs.filter(p => p.section === section);
				console.log(`   Paragraphes dans cette section: ${sectionParagraphs.length}`);

				// Calculer les indices de tableaux relatifs
				const tableIndices = new Set();
				sectionParagraphs.forEach(p => {
					if (p.isTableCell && p.tableIndex !== undefined) {
						tableIndices.add(p.tableIndex);
					}
				});

				const sortedTableIndices = Array.from(tableIndices).sort((a, b) => a - b);
				const relativeTableMap = {};
				sortedTableIndices.forEach((abs, rel) => {
					relativeTableMap[abs] = rel;
				});

				console.log(`   Tableaux: ${sortedTableIndices.length}`);
				if (sortedTableIndices.length > 0) {
					console.log(`   Mapping: ${sortedTableIndices.map((abs, rel) => `T${rel}=AbsT${abs}`).join(', ')}`);
				}

				// Appliquer indices relatifs
				const paragraphsWithRelativeIndices = sectionParagraphs.map((p, idx) => ({
					...p,
					index: idx,
					tableIndex: p.tableIndex !== undefined ? relativeTableMap[p.tableIndex] : undefined
				}));

				// Construire un prompt simplifié
				const prompt = buildTestPrompt(section, sectionTags, paragraphsWithRelativeIndices, relativeTableMap);

				// Simuler la réponse LLM
				const response = mockLLM(prompt);

				// Parser la réponse
				try {
					const parsed = JSON.parse(response);
					console.log(`\n   ✅ Placements reçus: ${parsed.placements?.length || 0}`);
				} catch (e) {
					console.log('   ❌ Erreur parsing réponse LLM');
				}
			}
		}

		console.log('\n\n✅ ════════════════════════════════════════════════════════');
		console.log('   TEST TERMINÉ');
		console.log('   ════════════════════════════════════════════════════════');
		console.log('\n   La structure section-par-section fonctionne!');
		console.log('   Testez maintenant avec le vrai nœud n8n.\n');

	} catch (error) {
		console.error('\n❌ ERREUR:', error.message);
		console.error(error.stack);
	}
}

function buildTestPrompt(section, tags, paragraphs, tableMap) {
	let prompt = `# AGENT REACT - SECTION ${section}

## CONTEXTE
- Section: ${section}
- Tags à placer: ${tags.length}
- Paragraphes disponibles: ${paragraphs.length}
- Tableaux dans cette section: ${Object.keys(tableMap).length}

## TAGS À PLACER
`;

	for (const tag of tags) {
		prompt += `- **{{${tag}}}**\n`;
	}

	prompt += `
## PARAGRAPHES DISPONIBLES
\`\`\`json
${JSON.stringify(
		paragraphs.slice(0, 50).map(p => ({
			idx: p.index,
			text: p.text.substring(0, 50),
			isCell: p.isTableCell,
			pos: p.tableIndex !== undefined ? `T${p.tableIndex}R${p.rowIndex}C${p.columnIndex}` : null,
			empty: p.text.trim().length < 3
		})),
		null,
		2
	)}
\`\`\`
`;

	return prompt;
}

// Exécuter le test
runTest();
