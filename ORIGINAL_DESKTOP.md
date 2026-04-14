# 📱 ORIGINAL DESKTOP VERSION

## ⚠️ IMPORTANT - NE PAS MODIFIER

Ce dossier contient la **version originale** du projet NexaStory Desktop.

### 📋 Informations

| Propriété | Valeur |
|-----------|--------|
| **Nom** | NexaStory Desktop |
| **Version** | 0.2.0 |
| **Source** | https://github.com/isaacbell199/Test2.git |
| **Date de sauvegarde** | $(date +%Y-%m-%d) |
| **Type** | Application Desktop Tauri |

### 🏗️ Architecture

```
├── src/                    # Frontend Next.js + React
│   ├── app/               # Pages et layout
│   ├── components/        # Composants UI
│   │   ├── ui/           # Composants shadcn/ui (49 composants)
│   │   ├── views/        # Vues principales
│   │   └── sidebar.tsx   # Navigation latérale
│   ├── lib/              # Utilitaires et store
│   └── hooks/            # Hooks React
│
├── src-tauri/             # Backend Rust (Tauri)
│   ├── src/
│   │   ├── lib.rs        # Point d'entrée Tauri
│   │   ├── commands.rs   # Commandes IPC
│   │   ├── database.rs   # Opérations SQLite
│   │   ├── llm.rs        # Intégration LLM (llama.cpp)
│   │   ├── models.rs     # Structures de données
│   │   └── settings.rs   # Gestion paramètres
│   └── tauri.conf.json   # Configuration Tauri
│
└── public/               # Assets statiques
```

### 🚀 Commandes Disponibles

```bash
# Développement
bun run dev              # Serveur Next.js
bun run tauri:dev        # Application Tauri

# Build (choisir selon le matériel)
bun run build:cpu        # CPU uniquement
bun run build:cuda       # NVIDIA GPU
bun run build:metal      # Apple Silicon
bun run build:vulkan     # AMD/Intel GPU
bun run build:auto       # Détection automatique
```

### 📦 Technologies

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS 4
- **UI Components**: shadcn/ui (49 composants)
- **State**: Zustand avec persistence
- **Backend**: Tauri 2 (Rust)
- **Database**: SQLite via sqlx
- **LLM**: llama.cpp (GGUF Models)

### 🔄 Workflow de Développement

1. **Version Cloud** → Modifications et tests UI
2. **Original Desktop** ← Migration des composants validés
3. Adaptation des appels API (fetch → Tauri invoke)

---

*Ce fichier marque cette version comme la référence originale.*
