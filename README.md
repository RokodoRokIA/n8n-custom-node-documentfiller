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
