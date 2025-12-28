# n8n-nodes-docx-filler

Nodes n8n pour remplir automatiquement des documents DOCX avec des tags `{{TAG}}`.

**Parfait pour:** Formulaires administratifs, contrats, devis, ou tout document avec des champs a remplir.

## Les 2 Nodes

| Node | Description | LLM requis |
|------|-------------|------------|
| **DOCX Template Filler** | Remplit un document avec tags | Optionnel |
| **Template Mapper** | Insere des tags dans un document via IA | Oui |

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
CAS 1: Template deja tague (ex: TEMPLATE_TAGS.docx)

  Webhook ──► DOCX Template Filler ──► Document rempli
  + JSON
  + DOCX


CAS 2: Nouveau document (sans tags)

  Template Reference ─┐
  (avec tags)         │
                      ├──► Template Mapper ──► Doc avec tags ─┐
  Document vierge ────┘    + LLM                              │
  (sans tags)                                                 │
                                                              v
  Donnees JSON ──────────────────────────► DOCX Template Filler
                                                              │
                                                              v
                                                    Document rempli
```

---

## Node 1: DOCX Template Filler

Remplit un document DOCX contenant des tags `{{TAG}}` avec des donnees JSON.

### Configuration

```
Node: DOCX Template Filler
├── Mode de Mapping:
│   ├─ Standard: Schema de tags predefini (gratuit)
│   ├─ IA: Mapping intelligent par LLM (flexible)
│   └─ Hybride: Standard + IA pour les inconnus
├── Type de Document: dc1 / dc2 / ae / autre
├── Document a Remplir: data (propriete binaire)
├── Donnees: (vide = tout le JSON)
└── LLM (optionnel): Connecter pour mode IA/Hybride
```

### Exemple

```
Input:
├── Binary "data": TEMPLATE.docx (avec {{NOM_COMMERCIAL}}, {{SIRET}}...)
└── JSON: { "entreprise": { "nom_commercial": "ROKODO", "siret": "123..." } }

Output:
└── Binary "data": ROKODO_DOC_2024-12-29.docx (rempli)
```

---

## Node 2: Template Mapper

Analyse un template de reference et insere les tags dans un nouveau document.

### Configuration

```
Node: Template Mapper
├── Template de Reference: template (propriete binaire avec tags)
├── Document Cible: data (propriete binaire sans tags)
├── Type de Document: DC1 / DC2 / AE
├── LLM (requis): Connecter un modele pour l'analyse
└── Options:
    └─ Seuil de Confiance: 70 (minimum pour inserer)
```

### Exemple

```
Input:
├── Binary "template": TEMPLATE_TAGS.docx (reference avec {{NOM_COMMERCIAL}}...)
└── Binary "data": DOCUMENT_VIERGE.docx (document sans tags)

Output:
└── Binary "data": DOCUMENT_TAGGED.docx (avec tags inseres)
```

---

## Structure JSON attendue

```json
{
  "entreprise": {
    "nom_commercial": "ROKODO.IO",
    "denomination_sociale": "ROKODO.IO SAS",
    "siret": "89198692900018",
    "adresse": "13 rue Camille Desmoulins, 92130 Issy-Les-Moulineaux",
    "adresse_siege": "13 rue Camille Desmoulins, 92130 Issy-Les-Moulineaux",
    "email": "contact@rokodo.io",
    "telephone": "+33 6 89 09 33 41",
    "forme_juridique": "SAS"
  },
  "chiffres_affaires": {
    "n": { "annee": "2023", "ca_global": "1 080 000" },
    "n1": { "annee": "2022", "ca_global": "527 000" },
    "n2": { "annee": "2021", "ca_global": "560 000" }
  },
  "signataire": {
    "nom": "BELONCLE",
    "prenom": "Rodolphe",
    "qualite": "President"
  },
  "checkboxes": {
    "candidat_seul": true,
    "groupement": false,
    "pme": true
  },
  "date_signature": "29/12/2024",
  "lieu_signature": "Issy-Les-Moulineaux"
}
```

---

## Tags standardises (Mode Standard)

### Entreprise
| Tag | Chemin JSON |
|-----|-------------|
| `{{NOM_COMMERCIAL}}` | entreprise.nom_commercial |
| `{{DENOMINATION}}` | entreprise.denomination_sociale |
| `{{SIRET}}` | entreprise.siret |
| `{{SIREN}}` | entreprise.siret (9 premiers) |
| `{{ADRESSE}}` | entreprise.adresse |
| `{{EMAIL}}` | entreprise.email |
| `{{TELEPHONE}}` | entreprise.telephone |
| `{{FORME_JURIDIQUE}}` | entreprise.forme_juridique |

### Chiffres d'Affaires
| Tag | Chemin JSON |
|-----|-------------|
| `{{CA_N}}` | chiffres_affaires.n.ca_global |
| `{{CA_N_ANNEE}}` | chiffres_affaires.n.annee |
| `{{CA_N1}}` | chiffres_affaires.n1.ca_global |
| `{{CA_N2}}` | chiffres_affaires.n2.ca_global |

### Signataire
| Tag | Chemin JSON |
|-----|-------------|
| `{{SIGNATAIRE_NOM}}` | signataire.nom |
| `{{SIGNATAIRE_PRENOM}}` | signataire.prenom |
| `{{SIGNATAIRE_QUALITE}}` | signataire.qualite |

### Checkboxes
| Tag | Valeur |
|-----|--------|
| `{{CHECK_CANDIDAT_SEUL}}` | Coche si true |
| `{{CHECK_GROUPEMENT}}` | Coche si true |
| `{{CHECK_PME}}` | Coche si true |

### Date/Lieu
| Tag | Chemin JSON |
|-----|-------------|
| `{{DATE_SIGNATURE}}` | date_signature |
| `{{LIEU_SIGNATURE}}` | lieu_signature |

---

## LLM supportes

Le mode IA fonctionne avec tous les LLM de n8n:

- **OpenAI** (GPT-4, GPT-4o, GPT-3.5)
- **Anthropic** (Claude 3)
- **Ollama** (Llama, Mistral, etc. - local et gratuit)
- **Azure OpenAI**
- **Google Gemini**
- **Mistral AI**

---

## Troubleshooting

### Les tags ne sont pas remplaces
- Format correct: `{{TAG_NAME}}` (double accolades, majuscules)
- En mode Standard, seuls les tags du schema sont reconnus
- Utilisez le mode IA pour des tags personnalises

### Template Mapper n'insere pas tous les tags
- Augmentez le seuil de confiance
- Verifiez que les documents sont du meme type
- Le document cible doit avoir une structure similaire

### Document corrompu
- Verifiez que les fichiers source sont des DOCX valides
- Ne modifiez pas le XML manuellement

---

## Licence

MIT - Rokodo.io
