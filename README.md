# Qortium Recipes

A QDN app for publishing, browsing, and scaling community recipes.

- App resource: `qdn://APP/Recipes/Recipes`
- Developer reference: `qdn://APP/Recipes/Recipes?view=developers`
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

## Home display settings

Recipes follows Qortium Home's resolved light/dark theme, accent, text size,
language direction, and Classic/Modern/Fun UI family. It reads render URL and
host-injected settings before first paint, feature-detects `GET_HOME_SETTINGS`,
and accepts both legacy display messages and the current Home settings events
while it is open. Browser development can exercise the same contract with
query parameters such as:

```text
?theme=dark&accent=purple&textSize=huge&uiStyle=fun&lang=he
```

## Data model

Each recipe is a separate versioned JSON resource under its author's registered Qortal
name. Ingredient entries preserve the original text and may additionally carry a numeric
amount, optional maximum, unit, item text, and `scalable` flag. The viewer changes only
confirmed numeric amounts; free-text entries such as `salt to taste` remain unchanged.

The app exports Schema.org `Recipe` JSON-LD for interchange. RecipeMD and website imports
are possible future adapters, but arbitrary text parsing is deliberately best-effort and
reviewed by the author.

The always-English in-app Developers workspace is the authoritative public
contract for the schema, resource tuple, limits, ownership, QDN bridge actions,
publication lifecycle, scaling rules, and Schema.org mapping. Recipe payloads
are currently limited by the app to 512,000 UTF-8 bytes.
