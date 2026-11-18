# Dépensio

Dépensio est une application web de suivi des revenus, des dépenses et du solde, en francs guinéens (GNF). Chaque utilisateur possède son propre compte et ne voit que ses transactions.

## Fonctionnalités

- Création de compte, connexion et déconnexion.
- Ajout et suppression de transactions.
- Affichage du solde, des revenus et des dépenses.
- Isolation des transactions par utilisateur.

Les revenus sont enregistrés avec un montant positif et les dépenses avec un montant négatif.

## Technologies

- **Frontend :** Next.js, React, TypeScript et Tailwind CSS.
- **Backend :** Django et Django REST Framework.
- **Base de données locale :** SQLite.
- **Authentification API :** sessions Django et protection CSRF.

## Structure du dépôt

```text
Backend/
  api/       API, authentification et transactions
  backend/   configuration du projet Django
frontend/
  app/       interface et appels à l’API
  public/    ressources statiques
```

## Lancer le projet en local (Windows / PowerShell)

### 1. Démarrer le backend

Depuis la racine du dépôt :

```powershell
cd Backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install Django==6.1.3 djangorestframework==3.18.3 django-cors-headers==4.9.0
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py runserver
```

L’API est alors accessible sur `http://localhost:8000/api/`.

### 2. Configurer et démarrer le frontend

Dans un second terminal, crée `frontend/.env.local` avec :

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

Puis lance le frontend :

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

Ouvre ensuite `http://localhost:3000`.

## Routes API principales

| Méthode | Route | Description |
| --- | --- | --- |
| `GET` | `/api/auth/csrf/` | Obtenir le jeton CSRF |
| `POST` | `/api/auth/register/` | Créer un compte |
| `POST` | `/api/auth/login/` | Se connecter |
| `GET` | `/api/auth/me/` | Obtenir le compte connecté |
| `POST` | `/api/auth/logout/` | Se déconnecter |
| `GET`, `POST` | `/api/transactions/` | Lister ou ajouter des transactions |
| `GET`, `PUT`, `PATCH`, `DELETE` | `/api/transactions/<uuid>/` | Consulter, modifier ou supprimer une transaction |

Les routes de transactions nécessitent une session authentifiée.

## Vérifications

```powershell
# Backend, depuis le dossier Backend
.\.venv\Scripts\python.exe manage.py test

# Frontend, depuis le dossier frontend
npm.cmd run lint
npm.cmd run build
```

La configuration Django actuelle est destinée au développement local. Elle doit être sécurisée et adaptée avant tout déploiement en production.
