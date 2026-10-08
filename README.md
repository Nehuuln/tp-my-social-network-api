# My Social Networks API

![Node.js](https://img.shields.io/badge/Node.js-18-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?style=for-the-badge&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![Mongoose](https://img.shields.io/badge/Mongoose-8-880000?style=for-the-badge&logo=mongoose&logoColor=white)
![JWT](https://img.shields.io/badge/JWT-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white)
![Postman](https://img.shields.io/badge/Postman-FF6C37?style=for-the-badge&logo=postman&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)

API REST d'un réseau social centré sur les événements : utilisateurs, groupes, événements, fils de discussion, albums photo, sondages et billetterie.

Réalisée avec Node.js, Express et MongoDB (Mongoose).

## Sommaire

- [Prérequis](#prérequis)
- [Installation](#installation)
- [Tester avec Postman](#tester-avec-postman)
- [Fonctionnement général](#fonctionnement-général)
- [Endpoints](#endpoints)
- [Sécurité](#sécurité)
- [Collections MongoDB](#collections-mongodb)
- [Structure du projet](#structure-du-projet)

## Prérequis

- **Node.js 18** 
- Une base **MongoDB** 
- **OpenSSL** pour générer le certificat HTTPS

## Installation

### 1. Dépendances

```bash
git clone <url-du-repo>
cd tp-my-social-network-api
npm install
```

### 2. Variables d'environnement

Copier `.env.example` vers `.env` puis adapter les valeurs :

```bash
cp .env.example .env
```

| Variable | Obligatoire | Rôle | Exemple |
|---|---|---|---|
| `PORT` | oui | Port d'écoute de l'API | `3000` |
| `MONGODB_URI` | oui | URI de connexion MongoDB | `mongodb://127.0.0.1:27017/my-social-networks` |
| `JWT_SECRET` | oui | Clé de signature des tokens JWT | une longue chaîne aléatoire |
| `CORS_ORIGIN` | oui | Origine autorisée à appeler l'API depuis un navigateur | `http://localhost:5173` |
| `RATE_LIMIT_MAX` | non | Requêtes autorisées par IP sur 15 minutes (100 par défaut) | `100` |
| `AUTH_RATE_LIMIT_MAX` | non | Requêtes autorisées par IP sur `/auth` sur 15 minutes (10 par défaut) | `10` |
| `SSL_KEY_PATH` | non | Chemin de la clé privée (`ssl/social-network.key` par défaut) | `ssl/social-network.key` |
| `SSL_CERT_PATH` | non | Chemin du certificat (`ssl/social-network.crt` par défaut) | `ssl/social-network.crt` |

### 3. Certificat HTTPS

L'API ne répond qu'en HTTPS. Le dossier `ssl/` n'est pas versionné : il faut générer un certificat auto-signé avant le premier lancement.

```bash
mkdir -p ssl
openssl genrsa -out ssl/social-network.key 2048
openssl req -new -key ssl/social-network.key -out ssl/social-network.csr
openssl x509 -req -days 365 -in ssl/social-network.csr -signkey ssl/social-network.key -out ssl/social-network.crt
```

### 4. Lancement

```bash
npm run dev
```

L'API est disponible sur `https://localhost:3000`.

## Tester avec Postman

La collection se trouve dans [postman/My Social Network API.postman_collection.json](postman/My%20Social%20Network%20API.postman_collection.json).

1. Importer la collection dans Postman.
2. Créer un environnement avec la variable `baseUrl` = `https://localhost:3000`.
3. Désactiver **SSL certificate verification** dans les réglages de Postman (le certificat est auto-signé).
4. Lancer **Auth > Register**, puis **Auth > Login** : le token est enregistré automatiquement dans la variable `token` et réutilisé par toutes les autres requêtes.

## Fonctionnement général

### Authentification

Toutes les routes demandent un token JWT, sauf l'inscription, la connexion et les routes publiques de la billetterie. Le token est renvoyé par `/auth/register` et `/auth/login`, il est valable 24 heures et s'envoie dans l'en-tête :

```
Authorization: Bearer <token>
```

### Format des erreurs

Toutes les erreurs ont la même forme. Le champ `errors` n'est présent que pour les erreurs de validation et les doublons.

```json
{
    "code": 400,
    "message": "Validation failed",
    "errors": [
        { "field": "name", "message": "name is required" }
    ]
}
```

| Code | Signification |
|---|---|
| 400 | Données invalides (champ manquant, mauvais format, identifiant invalide) |
| 401 | Token manquant, invalide ou expiré |
| 403 | Action interdite pour cet utilisateur |
| 404 | Ressource introuvable, ou invisible pour cet utilisateur |
| 409 | Conflit (email déjà utilisé, déjà membre, billets épuisés…) |
| 429 | Trop de requêtes |

### Règles de visibilité

- **Événement public** : visible par tous les utilisateurs connectés.
- **Événement privé** : visible uniquement par ses participants. Pour les autres, l'API répond 404.
- **Groupe public** : visible et rejoignable par tous.
- **Groupe privé** : visible par tous, mais seul un administrateur peut y ajouter des membres.
- **Groupe secret** : visible uniquement par ses membres. Pour les autres, l'API répond 404.
- Un événement créé dans un groupe privé ou secret est forcément privé.

Les albums, les sondages et le fil de discussion d'un événement suivent la visibilité de cet événement.

## Endpoints

Dans les tableaux, la colonne « Accès » indique qui peut appeler la route.

### Authentification

| Méthode | Route | Description | Accès |
|---|---|---|---|
| POST | `/auth/register` | Créer un compte, renvoie l'utilisateur et un token | public |
| POST | `/auth/login` | Se connecter, renvoie un token | public |

Corps de `/auth/register` : `firstname`, `lastname`, `email`, `password` (8 caractères minimum), `avatar` (URL, optionnel). Deux utilisateurs ne peuvent pas avoir le même email.

### Utilisateurs

| Méthode | Route | Description | Accès |
|---|---|---|---|
| GET | `/users` | Lister les utilisateurs | connecté |
| GET | `/users/:id` | Détail d'un utilisateur | connecté |
| PUT | `/users/:id` | Modifier son compte | soi-même |
| DELETE | `/users/:id` | Supprimer son compte | soi-même |

Le mot de passe est haché avec bcrypt et n'est jamais renvoyé.

### Groupes

| Méthode | Route | Description | Accès |
|---|---|---|---|
| POST | `/groups` | Créer un groupe (le créateur devient administrateur et membre) | connecté |
| GET | `/groups` | Lister les groupes visibles | connecté |
| GET | `/groups/:id` | Détail d'un groupe | selon la visibilité |
| PUT | `/groups/:id` | Modifier un groupe | administrateur |
| DELETE | `/groups/:id` | Supprimer un groupe | administrateur |
| POST | `/groups/:id/join` | Rejoindre un groupe public | connecté |
| POST | `/groups/:id/members` | Ajouter un membre (`user_id`) | administrateur |
| DELETE | `/groups/:id/members/:userId` | Retirer un membre, ou quitter le groupe | administrateur ou soi-même |
| POST | `/groups/:id/administrators` | Nommer un administrateur (`user_id`) | administrateur |
| DELETE | `/groups/:id/administrators/:userId` | Retirer un administrateur | administrateur |

Corps d'un groupe : `name`, `description`, `icon` (URL), `cover` (URL), `type` (`public`, `private` ou `secret`), `allow_members_to_post`, `allow_members_to_create_events`.

Un groupe garde toujours au moins 1 membre et 1 administrateur.

### Événements

| Méthode | Route | Description | Accès |
|---|---|---|---|
| POST | `/events` | Créer un événement (le créateur devient organisateur) | connecté |
| POST | `/groups/:id/events` | Créer un événement dans un groupe, tous les membres sont invités automatiquement | membre, ou administrateur selon le réglage du groupe |
| GET | `/events` | Lister les événements visibles | connecté |
| GET | `/groups/:id/events` | Lister les événements d'un groupe | selon la visibilité |
| GET | `/events/:id` | Détail d'un événement | selon la visibilité |
| PUT | `/events/:id` | Modifier un événement | organisateur |
| DELETE | `/events/:id` | Supprimer un événement | organisateur |
| POST | `/events/:id/join` | Participer à un événement | connecté |
| POST | `/events/:id/participants` | Ajouter un participant (`user_id`) | organisateur |
| DELETE | `/events/:id/participants/:userId` | Retirer un participant, ou quitter l'événement | organisateur ou soi-même |
| POST | `/events/:id/organizers` | Nommer un organisateur (`user_id`) | organisateur |
| DELETE | `/events/:id/organizers/:userId` | Retirer un organisateur | organisateur |
| GET | `/events/:id/share` | Obtenir les liens de partage d'un événement public | organisateur |

Corps d'un événement : `name`, `description`, `start_date`, `end_date`, `location`, `cover` (URL), `visibility` (`public` ou `private`), `organizers` et `participants` (tableaux d'identifiants d'utilisateurs).

Un événement garde toujours au moins 1 organisateur, et `end_date` ne peut pas précéder `start_date`.

### Fils de discussion

Un fil est lié à 1 groupe ou à 1 événement, jamais aux deux. Il est créé automatiquement au premier accès.

| Méthode | Route | Description | Accès |
|---|---|---|---|
| GET | `/groups/:id/thread` | Obtenir le fil d'un groupe | selon la visibilité |
| GET | `/events/:id/thread` | Obtenir le fil d'un événement | selon la visibilité |
| GET | `/threads/:id/messages` | Lister les messages avec leurs réponses | selon la visibilité |
| POST | `/threads/:id/messages` | Publier un message (`content`) | membre ou participant |
| POST | `/threads/:id/messages/:messageId/replies` | Répondre à un message (`content`) | membre ou participant |
| PUT | `/threads/:id/messages/:messageId` | Modifier un message | auteur |
| DELETE | `/threads/:id/messages/:messageId` | Supprimer un message et ses réponses | auteur, administrateur ou organisateur |

Dans un groupe où `allow_members_to_post` est désactivé, seuls les administrateurs publient ; les membres peuvent toujours répondre.

### Albums photo

Un album est associé à 1 événement.

| Méthode | Route | Description | Accès |
|---|---|---|---|
| POST | `/events/:id/albums` | Créer un album (`name`, `description`) | participant |
| GET | `/events/:id/albums` | Lister les albums d'un événement | selon la visibilité |
| GET | `/albums/:id` | Détail d'un album avec ses photos | selon la visibilité |
| PUT | `/albums/:id` | Modifier un album | créateur ou organisateur |
| DELETE | `/albums/:id` | Supprimer un album, ses photos et leurs commentaires | créateur ou organisateur |
| POST | `/albums/:id/photos` | Poster une photo (`url`, `caption`) | participant |
| GET | `/albums/:id/photos` | Lister les photos | selon la visibilité |
| GET | `/albums/:id/photos/:photoId` | Détail d'une photo avec ses commentaires | selon la visibilité |
| PUT | `/albums/:id/photos/:photoId` | Modifier la légende | auteur |
| DELETE | `/albums/:id/photos/:photoId` | Supprimer une photo et ses commentaires | auteur ou organisateur |
| POST | `/albums/:id/photos/:photoId/comments` | Commenter une photo (`content`) | participant |
| GET | `/albums/:id/photos/:photoId/comments` | Lister les commentaires | selon la visibilité |
| PUT | `/albums/:id/photos/:photoId/comments/:commentId` | Modifier un commentaire | auteur |
| DELETE | `/albums/:id/photos/:photoId/comments/:commentId` | Supprimer un commentaire | auteur ou organisateur |

### Sondages

| Méthode | Route | Description | Accès |
|---|---|---|---|
| POST | `/events/:id/polls` | Créer un sondage | organisateur |
| GET | `/events/:id/polls` | Lister les sondages d'un événement | selon la visibilité |
| GET | `/polls/:id` | Détail d'un sondage | selon la visibilité |
| PUT | `/polls/:id` | Modifier un sondage | organisateur |
| DELETE | `/polls/:id` | Supprimer un sondage et ses réponses | organisateur |
| POST | `/polls/:id/responses` | Répondre au sondage | participant |
| GET | `/polls/:id/responses/me` | Consulter sa réponse | auteur de la réponse |
| PUT | `/polls/:id/responses/me` | Modifier sa réponse | auteur de la réponse |
| DELETE | `/polls/:id/responses/me` | Retirer sa réponse | auteur de la réponse |
| GET | `/polls/:id/responses` | Lister toutes les réponses | organisateur |
| GET | `/polls/:id/results` | Nombre de votes par réponse | selon la visibilité |

Création d'un sondage :

```json
{
    "title": "Organisation du cours API",
    "questions": [
        {
            "title": "Quel horaire vous convient le mieux ?",
            "answers": [{ "label": "Matin" }, { "label": "Après-midi" }]
        }
    ]
}
```

Réponse à un sondage, avec les identifiants renvoyés à la création :

```json
{
    "answers": [
        { "question": "<id de la question>", "answer": "<id de la réponse choisie>" }
    ]
}
```

Règles :

- un sondage comporte au moins 1 question, et chaque question au moins 2 réponses possibles ;
- un participant répond une seule fois, en choisissant exactement 1 réponse pour chaque question ;
- les questions ne sont plus modifiables dès qu'un participant a répondu.

### Billetterie

Seul un événement public peut avoir une billetterie. La consultation des billets et l'achat sont ouverts aux personnes extérieures, donc sans token.

| Méthode | Route | Description | Accès |
|---|---|---|---|
| POST | `/events/:id/ticket-types` | Créer un type de billet (`name`, `amount`, `quantity`) | organisateur |
| GET | `/events/:id/ticket-types` | Lister les types de billets d'un événement | public |
| GET | `/ticket-types/:id` | Détail d'un type de billet | public |
| PUT | `/ticket-types/:id` | Modifier un type de billet | organisateur |
| DELETE | `/ticket-types/:id` | Supprimer un type de billet sans vente | organisateur |
| POST | `/ticket-types/:id/tickets` | Acheter un billet | public |
| GET | `/events/:id/tickets` | Lister les billets vendus | organisateur |
| GET | `/tickets/:id` | Détail d'un billet | organisateur |
| DELETE | `/tickets/:id` | Annuler un billet et remettre la place en stock | organisateur |

Achat d'un billet :

```json
{
    "lastname": "Ye",
    "firstname": "Maxime",
    "email": "maximeye@gmail.com",
    "address": {
        "street": "30-32 Avenue de la République",
        "zip_code": "94800",
        "city": "Villejuif",
        "country": "France"
    }
}
```

Règles :

- chaque type de billet renvoie `sold` (billets vendus) et `remaining` (billets restants) ;
- une personne, identifiée par son email, ne peut obtenir qu'1 seul billet par événement ;
- quand la quantité est épuisée, l'achat est refusé (409), y compris en cas d'achats simultanés ;
- la date d'achat (`purchased_at`) est enregistrée automatiquement ;
- la quantité d'un type de billet ne peut pas descendre sous le nombre de billets déjà vendus.

## Sécurité

- **HTTPS** : le serveur n'écoute qu'en HTTPS, avec le certificat du dossier `ssl/`.
- **Helmet** : ajoute les en-têtes HTTP de sécurité et retire `X-Powered-By`.
- **CORS** : seule l'origine définie dans `CORS_ORIGIN` peut appeler l'API depuis un navigateur, avec les méthodes GET, POST, PUT, DELETE.
- **Limitation de débit** : 100 requêtes par IP sur 15 minutes pour toute l'API, et 10 sur `/auth` pour freiner les attaques par force brute. Au-delà, l'API répond 429.
- **JWT** : tokens signés, valables 24 heures.
- **Mots de passe** : hachés avec bcrypt, jamais renvoyés par l'API.
- **Validation** : toutes les données entrantes sont validées par les schémas Mongoose (types, longueurs, formats d'email et d'URL).

## Collections MongoDB

| Collection | Contenu |
|---|---|
| `users` | Utilisateurs |
| `groups` | Groupes, avec leurs membres et administrateurs |
| `events` | Événements, avec leurs participants et organisateurs |
| `threads` | Fils de discussion (1 par groupe ou par événement) |
| `messages` | Messages et réponses des fils de discussion |
| `albums` | Albums photo des événements |
| `photos` | Photos des albums |
| `comments` | Commentaires des photos |
| `polls` | Sondages, avec leurs questions et réponses possibles |
| `poll_responses` | Réponses des participants aux sondages |
| `ticket_types` | Types de billets |
| `tickets` | Billets achetés |

## Structure du projet

```
├── index.mjs          Point d'entrée
├── src/server.mjs     Configuration du serveur (HTTPS, middlewares, routes)
├── controllers/       Routes, une classe par ressource
├── models/            Schémas Mongoose et validators
├── middlewares/       Authentification JWT, CORS, limitation de débit
├── utils/             Fonctions partagées (erreurs, utilisateurs)
├── postman/           Collection Postman
└── ssl/               Certificat HTTPS (non versionné)
```
