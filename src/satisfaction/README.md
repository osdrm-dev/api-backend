# Module de Satisfaction

Module pour gérer les enquêtes de satisfaction à la fin d'un achat.

## Endpoints

### 1. Soumettre une enquête de satisfaction

```
POST /satisfaction/:purchaseId
```

**Body:**

```json
{
  "rating": 5,
  "comment": "Excellent service !",
  "deliveryRating": 5,
  "qualityRating": 4,
  "serviceRating": 5,
  "fileIds": [1, 2, 3]
}
```

**Conditions:**

- L'achat doit être terminé (status: VALIDATED ou currentStep: DONE)
- Une seule enquête par achat
- Les fileIds sont optionnels et doivent correspondre à des fichiers existants

### 2. Récupérer l'enquête d'un achat

```
GET /satisfaction/purchase/:purchaseId
```

### 3. Récupérer toutes les enquêtes

```
GET /satisfaction
```

### 4. Obtenir les statistiques

```
GET /satisfaction/statistics/summary
```

**Réponse:**

```json
{
  "total": 10,
  "averageRating": 4.5,
  "averageDeliveryRating": 4.2,
  "averageQualityRating": 4.7,
  "averageServiceRating": 4.3
}
```

## Endpoints - Pièces jointes

### 5. Uploader une pièce jointe

```
POST /satisfaction/attachments/:surveyId
```

**Content-Type:** `multipart/form-data`

**Body:**

- `file`: Fichier à uploader (max 10MB)

**Types acceptés:**

- Images: JPEG, PNG, GIF
- Documents: PDF, Word (.doc, .docx)

### 6. Supprimer une pièce jointe

```
DELETE /satisfaction/attachments/:attachmentId
```

## Modèle de données

### SatisfactionSurvey

- `rating`: Note globale (1-5) - **Obligatoire**
- `comment`: Commentaire libre - Optionnel
- `deliveryRating`: Note de livraison (1-5) - Optionnel
- `qualityRating`: Note de qualité (1-5) - Optionnel
- `serviceRating`: Note de service (1-5) - Optionnel
- `attachments`: Liste des pièces jointes - Optionnel

### SatisfactionAttachment

- `fileName`: Nom du fichier
- `fileUrl`: URL du fichier
- `fileSize`: Taille en octets
- `mimeType`: Type MIME

## Utilisation

L'enquête de satisfaction doit être affichée côté frontend lorsque :

- L'achat a le status `VALIDATED`
- OU l'achat a atteint l'étape `DONE`
- ET aucune enquête n'a encore été soumise pour cet achat

## Workflow avec pièces jointes

1. L'utilisateur remplit le formulaire de satisfaction
2. (Optionnel) L'utilisateur peut uploader des fichiers (captures d'écran, photos, etc.)
3. L'utilisateur soumet le formulaire avec les IDs des fichiers uploadés
4. Les pièces jointes sont liées à l'enquête de satisfaction
