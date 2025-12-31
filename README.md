# n8n-nodes-docx-filler

Nodes n8n pour remplir automatiquement des documents DOCX avec des tags `{{TAG}}`.

**Parfait pour:** Contrats, factures, devis, formulaires, lettres, ou tout document avec des champs a remplir.

## Les 2 Nodes

| Node | Role | LLM requis |
|------|------|------------|
| **Template Mapper** | Analyse un document vierge et insere les tags `{{TAG}}` via IA | Oui |
| **DOCX Template Filler** | Remplit les tags avec les valeurs JSON | Non |

---

## Installation

```bash
# Dans votre installation n8n
npm install n8n-nodes-docx-filler

# Ou en mode developpement
cd ~/.n8n/custom
git clone https://github.com/rokodo-io/n8n-nodes-docx-filler
cd n8n-nodes-docx-filler
npm install && npm run build
# Redemarrer n8n
```

---

## Workflow Complet

```
ETAPE 1: Creer le template (une seule fois par type de document)

  Document vierge ─────┐
  (ex: contrat.docx)   │
                       ├──► Template Mapper ──► Template avec {{TAGS}}
  Structure JSON ──────┘    + LLM              + dataStructure exacte
  (champs a remplir)


ETAPE 2: Remplir le template (a chaque utilisation)

  Template avec tags ─────┐
  (ex: contrat_TEMPLATE)  │
                          ├──► DOCX Template Filler ──► Document rempli
  Donnees JSON ───────────┘
  (valeurs reelles)
```

---

## Node 1: Template Mapper

Analyse un document vierge et une structure JSON, puis utilise l'IA pour placer les tags `{{TAG}}` aux bons emplacements.

### Configuration

| Parametre | Description |
|-----------|-------------|
| **Document Vierge** | Propriete binaire contenant le DOCX a analyser |
| **Structure de Donnees** | JSON decrivant les champs a placer |
| **LLM (requis)** | Modele IA pour deduire les emplacements |

### Options

| Option | Description |
|--------|-------------|
| Seuil de Confiance | Score minimum (0-100) pour inserer un tag |
| Nom Fichier Sortie | Nom du template genere |
| Inclure Details | Affiche les scores de confiance (debug) |

### Exemple

**Entree:**
```json
{
  "client": {
    "nom": "",
    "email": "",
    "telephone": ""
  },
  "commande": {
    "numero": "",
    "date": "",
    "montant": ""
  }
}
```

**Sortie:**
- Document DOCX avec tags: `{{CLIENT_NOM}}`, `{{CLIENT_EMAIL}}`, `{{COMMANDE_NUMERO}}`, etc.
- `dataStructure` pour DocxTemplateFiller:
```json
{
  "dataStructure": {
    "CLIENT_NOM": "",
    "CLIENT_EMAIL": "",
    "CLIENT_TELEPHONE": "",
    "COMMANDE_NUMERO": "",
    "COMMANDE_DATE": "",
    "COMMANDE_MONTANT": ""
  }
}
```

---

## Node 2: DOCX Template Filler

Remplit un document DOCX contenant des tags `{{TAG}}` avec des donnees JSON.

### Configuration

| Parametre | Description |
|-----------|-------------|
| **Document Template** | Propriete binaire contenant le DOCX avec tags |
| **Source des Donnees** | JSON complet ou champ specifique |

### Options

| Option | Description |
|--------|-------------|
| Style Checkboxes | Unicode, Texte (X), ou Boolean |
| Nom Fichier Sortie | Nom du document genere |
| Conserver Tags Vides | Garder les `{{TAG}}` sans valeur |
| Rapport de Mapping | Liste des tags remplaces/restants |

### Exemple

**Entree:**
```json
{
  "client": {
    "nom": "Marie Dupont",
    "email": "marie@example.com",
    "telephone": "+33 6 12 34 56 78"
  },
  "commande": {
    "numero": "CMD-2024-001",
    "date": "30/12/2024",
    "montant": "1 250,00 EUR"
  }
}
```

**Sortie:**
- Document DOCX avec les valeurs inserees
- Rapport:
```json
{
  "success": true,
  "report": {
    "tagsReplaced": 6,
    "tagsRemaining": 0,
    "replacedTags": ["CLIENT_NOM", "CLIENT_EMAIL", "CLIENT_TELEPHONE", "COMMANDE_NUMERO", "COMMANDE_DATE", "COMMANDE_MONTANT"]
  }
}
```

---

## Conversion JSON vers Tags

Les cles JSON sont automatiquement converties en tags majuscules:

| Structure JSON | Tag genere |
|----------------|------------|
| `client.nom` | `{{CLIENT_NOM}}` |
| `client.email` | `{{CLIENT_EMAIL}}` |
| `adresse.rue` | `{{ADRESSE_RUE}}` |
| `produit.prix_unitaire` | `{{PRODUIT_PRIX_UNITAIRE}}` |
| `date_livraison` | `{{DATE_LIVRAISON}}` |

### Valeurs booleennes

Les booleens sont automatiquement convertis en checkboxes:

| JSON | Resultat (Unicode) | Resultat (Texte) |
|------|-------------------|------------------|
| `true` | ☑ | X |
| `false` | ☐ | (espace) |

---

## Exemple complet

### 1. Structure de donnees pour Template Mapper

```json
{
  "societe": {
    "nom": "",
    "adresse": "",
    "siret": ""
  },
  "client": {
    "nom": "",
    "prenom": "",
    "email": "",
    "adresse": ""
  },
  "devis": {
    "numero": "",
    "date": "",
    "validite": "",
    "montant_ht": "",
    "tva": "",
    "montant_ttc": ""
  },
  "conditions": {
    "paiement_30j": false,
    "paiement_comptant": false,
    "livraison_incluse": false
  },
  "signature": {
    "lieu": "",
    "date": ""
  }
}
```

### 2. Tags generes dans le document

```
{{SOCIETE_NOM}}, {{SOCIETE_ADRESSE}}, {{SOCIETE_SIRET}}
{{CLIENT_NOM}}, {{CLIENT_PRENOM}}, {{CLIENT_EMAIL}}, {{CLIENT_ADRESSE}}
{{DEVIS_NUMERO}}, {{DEVIS_DATE}}, {{DEVIS_VALIDITE}}
{{DEVIS_MONTANT_HT}}, {{DEVIS_TVA}}, {{DEVIS_MONTANT_TTC}}
{{CONDITIONS_PAIEMENT_30J}}, {{CONDITIONS_PAIEMENT_COMPTANT}}, {{CONDITIONS_LIVRAISON_INCLUSE}}
{{SIGNATURE_LIEU}}, {{SIGNATURE_DATE}}
```

### 3. Donnees pour remplir le template

```json
{
  "societe": {
    "nom": "TechCorp SAS",
    "adresse": "45 avenue des Champs, 75008 Paris",
    "siret": "123 456 789 00012"
  },
  "client": {
    "nom": "Martin",
    "prenom": "Jean",
    "email": "jean.martin@email.com",
    "adresse": "12 rue de la Paix, 69001 Lyon"
  },
  "devis": {
    "numero": "DEV-2024-0042",
    "date": "30/12/2024",
    "validite": "30 jours",
    "montant_ht": "5 000,00",
    "tva": "1 000,00",
    "montant_ttc": "6 000,00"
  },
  "conditions": {
    "paiement_30j": true,
    "paiement_comptant": false,
    "livraison_incluse": true
  },
  "signature": {
    "lieu": "Paris",
    "date": "30/12/2024"
  }
}
```

---

## LLM supportes

Template Mapper fonctionne avec tous les LLM de n8n:

- **OpenAI** (GPT-4, GPT-4o, GPT-3.5)
- **Anthropic** (Claude 3, Claude 3.5)
- **Ollama** (Llama, Mistral, Qwen - local et gratuit)
- **Azure OpenAI**
- **Google Gemini**
- **Mistral AI**

---

## Architecture Technique Detaillee

### Vue d'ensemble des deux noeuds

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           TEMPLATE MAPPER                                    │
│  (Utilise l'IA - Transfer Learning)                                         │
│                                                                              │
│  Document Cible (sans tags) ──┐                                             │
│                               ├──► Segmentation ──► Prompts LLM ──► Tags    │
│  Template Reference (avec tags) ─┘   par section     par segment    inseres │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DOCX TEMPLATE FILLER                                 │
│  (PAS d'IA - Remplacement direct)                                           │
│                                                                              │
│  Document avec {{TAGS}} ──┐                                                 │
│                           ├──► Flatten JSON ──► Replace Tags ──► Document   │
│  Donnees JSON ────────────┘   CLIENT_NOM       {{TAG}}→valeur     rempli   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Concept de Segmentation (Decoupage de Session)

Le **Template Mapper** utilise un systeme de **segmentation** pour ameliorer la precision du matching IA. Voici comment ca fonctionne:

#### Probleme sans segmentation

Sans segmentation, le LLM recoit tout le document en une seule fois:
- **Prompts trop volumineux**: Risque d'erreur HTTP 413 (Request Entity Too Large)
- **Confusions entre sections**: L'IA peut confondre des sections similaires (ex: plusieurs tableaux)
- **Moins de precision**: Plus le contexte est grand, moins l'IA est precise

#### Solution: La segmentation

```
┌──────────────────────────────────────────────────────────────────────────┐
│                     FLUX DE SEGMENTATION                                  │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. SEGMENTER les documents                                              │
│     Template:  [Section A] [Tableau CA] [Section B] [Signature]          │
│     Cible:     [Section A'] [Tableau CA'] [Section B'] [Signature']      │
│                                                                          │
│  2. MATCHER les segments (template ↔ cible)                              │
│     Section A ←→ Section A' (score: 85%)                                 │
│     Tableau CA ←→ Tableau CA' (score: 92%)                               │
│     etc.                                                                  │
│                                                                          │
│  3. GENERER un prompt CIBLE par paire de segments                        │
│     Prompt segment CA: "Tu as les tags CA_N, CA_N1... dans ce tableau"   │
│     → L'IA ne traite QUE ce segment, pas tout le document                │
│                                                                          │
│  4. COMBINER les resultats de tous les segments                          │
│     Matches totaux = Matches(A) + Matches(CA) + Matches(B) + ...         │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

#### Modes de segmentation disponibles

| Mode | Comportement |
|------|-------------|
| **auto** (defaut) | Active la segmentation si: document > 50KB OU > 10 tags OU tags repartis sur 3+ sections |
| **always** | Force la segmentation. Recommande pour les tableaux financiers (CA) |
| **never** | Desactive la segmentation. Utilise le prompt global |

#### Code concerne

```typescript
// Dans TemplateMapper.node.ts ligne 352-356
const useSegmentation = decideSegmentationMode(
  params.useSegmentation,  // 'auto' | 'always' | 'never'
  templateXml,
  extractedTags
);
```

### Approche Few-Shot Learning (v3.0)

Le systeme utilise maintenant une approche **Few-Shot Learning** pour que l'IA "consomme" vraiment la logique:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    AVANT vs APRES                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  AVANT (regles abstraites):                                                 │
│  ┌────────────────────────────────────────────────────────────┐             │
│  │ "REGLE 1: Les tags d'identification doivent etre places   │             │
│  │  APRES le label correspondant..."                          │             │
│  │ → L'IA IGNORE souvent ces regles                           │             │
│  └────────────────────────────────────────────────────────────┘             │
│                                                                              │
│  APRES (exemples concrets):                                                 │
│  ┌────────────────────────────────────────────────────────────┐             │
│  │ "### Tag: {{NOM_COMMERCIAL}}                               │             │
│  │  - Contexte template: 'Nom commercial :'                   │             │
│  │  - Candidat cible: idx=15 ('Nom commercial :...')"         │             │
│  │ → L'IA COMPREND par l'exemple                              │             │
│  └────────────────────────────────────────────────────────────┘             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Principe du Few-Shot Learning

1. **Montrer, pas expliquer**: Chaque tag est presente avec son contexte reel
2. **Pre-calcul des candidats**: Le systeme trouve les candidats probables AVANT d'appeler l'IA
3. **Format JSON strict**: L'IA voit le format exact attendu dans le prompt
4. **Validation robuste**: Parsing multi-strategies avec logs detailles

#### Fichiers modifies (v3.0)

| Fichier | Changement |
|---------|------------|
| `prompt.service.ts` | Nouvelle fonction `buildFewShotExamples()` |
| `segment-matcher.service.ts` | Prompt Few-Shot par segment |
| `llm.service.ts` | Parsing robuste avec logs detailles |

### Pourquoi l'IA peut ne pas "consommer la logique"

Il y a plusieurs raisons pour lesquelles le LLM peut ne pas retourner de matches valides:

#### 1. Le LLM ne retourne aucun match valide

```typescript
// Dans llm.service.ts ligne 128-139
return parsed.matches.filter((match) => {
  return (
    match.confidence >= 0.7 &&           // ❌ Confiance trop basse
    match.tag &&                          // ❌ Tag absent
    (match.targetParagraphIndex !== undefined || match.targetIdx !== undefined)
  );
});
```

**Cause**: L'IA retourne des matches avec `confidence < 0.7` → ils sont filtres.

#### 2. Reponse JSON invalide du LLM

```typescript
// Dans llm.service.ts ligne 149-153
} catch {
  // En cas d'erreur de parsing, retourner une liste vide
  return [];
}
```

**Cause**: Le LLM retourne du texte non-JSON ou du JSON mal forme.

#### 3. Fallback automatique vers pattern matching

```typescript
// Dans TemplateMapper.node.ts ligne 424-435
if (matches.length === 0) {
  console.log('⚠️ LLM n\'a retourne aucun match, fallback vers matching par patterns...');
  matches = patternBasedMatching(tagContexts, targetParagraphs);
  patternFallbackUsed = true;
}
```

**Cause**: Si l'IA echoue, le systeme utilise un matching par patterns (regex/similarite textuelle) comme secours.

#### 4. Limites de taille des prompts

```typescript
// Dans prompt.service.ts lignes 46-48
const MAX_PROMPT_SIZE = 60000;    // 60KB max
const MAX_PARAGRAPHS = 80;        // Max paragraphes envoyes au LLM
const MAX_TAG_CONTEXTS = 40;      // Max contextes de tags
```

**Cause**: Si le document depasse ces limites, des informations sont tronquees et l'IA peut manquer des correspondances.

#### 5. Qualite du modele LLM connecte

| Modele | Precision attendue | Recommandation |
|--------|-------------------|----------------|
| **GPT-4, GPT-4o** | Haute | Recommande |
| **Claude 3.5 Sonnet, Opus** | Haute | Recommande |
| **Gemini Pro** | Moyenne-Haute | OK |
| **Mistral Large** | Moyenne | OK pour documents simples |
| **Ollama (local)** | Variable | Depend du modele |
| **GPT-3.5** | Basse | Non recommande |

### Flux complet d'execution du Template Mapper

```
1. Charger les documents
   ├── Document cible (binaire → XML)
   └── Template reference (binaire → XML)

2. Extraire les tags du template
   └── Regex: /\{\{([A-Z][A-Z0-9_]*)\}\}/g

3. Extraire les contextes (labelBefore, section, type)
   └── Pour chaque tag: quel texte le precede?

4. DECISION: Segmentation ou Global?
   ├── Si 'always' ou criteres auto remplis → MODE SEGMENTE
   │   ├── Segmenter template et cible
   │   ├── Matcher les segments
   │   ├── Pour chaque paire:
   │   │   ├── Generer prompt cible
   │   │   ├── Appeler LLM
   │   │   └── Parser reponse
   │   └── Combiner resultats
   │
   └── Sinon → MODE GLOBAL
       ├── Generer prompt unique (tout le document)
       ├── Appeler LLM
       └── Parser reponse

5. FALLBACK si aucun match
   └── patternBasedMatching (regex + similarite)

6. Appliquer les tags au document cible
   ├── Pour chaque match:
   │   ├── Trouver le paragraphe XML
   │   ├── Inserer {{TAG}} selon insertionPoint
   │   └── Valider le XML
   └── Generer le document final

7. Retourner
   ├── Document DOCX tagge (binaire)
   ├── dataStructure (JSON pour DocxTemplateFiller)
   └── Statistiques (tags appliques, echecs)
```

### Points d'insertion des tags (insertionPoint)

| Type | Description | Exemple |
|------|-------------|---------|
| **after_colon** | Apres un label finissant par ":" | `Nom commercial :` → `Nom commercial : {{NOM}}` |
| **table_cell** | Dans une cellule de tableau | Cellule vide → `{{CA_N}}` |
| **replace_empty** | Remplace un paragraphe vide | `<w:p/>` → `<w:p>{{TAG}}</w:p>` |
| **inline** | Dans le texte existant | `Le montant est X` → `Le montant est {{MONTANT}}` |
| **checkbox** | Case a cocher | `☐` → `☑` ou `☐` selon valeur |

---

## Support des Checkboxes

Le systeme detecte et mappe automatiquement les cases a cocher entre le template et le document cible.

### Formats supportes

| Format | Detection | Exemple |
|--------|-----------|---------|
| **Unicode** | ☑ ☐ □ ✓ ✔ | `☐ Oui  ☑ Non` |
| **Word Form Controls** | FORMCHECKBOX | Controles de formulaire Word |

### Fonctionnement

```
┌─────────────────────────────────────────────────────────────────────┐
│                 MAPPING DES CHECKBOXES                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  TEMPLATE                          CIBLE                            │
│  ┌─────────────────────┐           ┌─────────────────────┐          │
│  │ ☐ Candidat seul     │    →      │ FORMCHECKBOX seul   │          │
│  │ ☑ Groupement        │    →      │ FORMCHECKBOX group. │          │
│  │ ☐ Oui  ☑ Non        │    →      │ FORMCHECKBOX Oui/Non│          │
│  └─────────────────────┘           └─────────────────────┘          │
│                                                                     │
│  Le systeme:                                                        │
│  1. Detecte les checkboxes dans les deux documents                  │
│  2. Extrait leur etat (coche/non coche)                            │
│  3. Trouve les correspondances par similarite semantique            │
│  4. Genere des tags booleens                                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Sortie JSON

Les checkboxes sont incluses dans la sortie:

```json
{
  "checkboxes": {
    "templateCount": 7,
    "targetCount": 7,
    "pairsDetected": 1,
    "tags": {
      "LE_CANDIDAT_SE_PRESENTE_SEUL": false,
      "GROUPEMENT_CONJOINT": true,
      "QUESTION_OUI_NON": false
    }
  }
}
```

### Paires Oui/Non

Le systeme detecte automatiquement les paires de checkboxes Oui/Non:

```
Template:  ☐ Oui  ☑ Non   →   Tag: {{QUESTION}} = false
Template:  ☑ Oui  ☐ Non   →   Tag: {{QUESTION}} = true
```

---

## Troubleshooting

### Les tags ne sont pas remplaces
- Format attendu: `{{TAG_NAME}}` (double accolades, majuscules, underscores)
- Verifiez que les cles JSON correspondent aux tags du document
- Utilisez le rapport de mapping pour voir les tags restants

### Template Mapper n'insere pas tous les tags
- Baissez le seuil de confiance (par defaut: 70)
- Verifiez que les noms de champs sont semantiquement clairs
- Activez "Inclure Details" pour voir les scores de confiance

### Document corrompu
- Verifiez que les fichiers source sont des DOCX valides
- N'utilisez pas de fichiers DOC (ancien format)

### Caracteres speciaux
- Les caracteres `<`, `>`, `&` sont automatiquement echappes
- Les accents et emojis sont supportes

---

## Licence

MIT - Rokodo.io
