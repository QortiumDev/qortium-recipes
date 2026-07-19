# Qortium Recipes

A QDN app for publishing, browsing, and scaling community recipes.

- App resource: `qdn://APP/Recipes/Recipes`
- Recipe resources: `qdn://JSON/<author>/qrecipes.v1.r.<id>`
- Recipe schema: `qortium.recipes.recipe.v1`

## Local development

```sh
npm install
npm run dev
```

The browser fallback reads from `http://127.0.0.1:24891` by default. Override it with
`VITE_QORTIUM_NODE_API_URL` when necessary. QDN publishing is intentionally available
only through Qortium Home's selected-account bridge.

## Validation

```sh
npm test
npm run build
```

## Data model

Each recipe is a separate versioned JSON resource under its author's registered Qortal
name. Ingredient entries preserve the original text and may additionally carry a numeric
amount, optional maximum, unit, item text, and `scalable` flag. The viewer changes only
confirmed numeric amounts; free-text entries such as `salt to taste` remain unchanged.

The app exports Schema.org `Recipe` JSON-LD for interchange. RecipeMD and website imports
are possible future adapters, but arbitrary text parsing is deliberately best-effort and
reviewed by the author.
