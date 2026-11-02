# Contributing

Contributions are welcome, from people and from their coding agents. Every change arrives as a
pull request from a fork and is reviewed before it's merged. Read the [README](README.md) first:
it documents the content format in detail.

## What's welcome

- **A new species found in Türkiye**: `content/species/<id>.md`, plus its genus (and any missing
  higher clades) in `content/tree/clades.yml` with a `content/clades/<id>.md` for each new clade.
- **Fixes to existing content**: a wrong edibility, habitat, lookalike note, Turkish or English text.
- **Photos** with a licence that allows reuse (see [Photos](README.md#photos)).
- **Bug fixes and small improvements** to the app. For larger changes, open an issue first.

## Rules for content

This site is about wild mushrooms, some of them deadly. Accuracy matters more than quantity.

- Only add species with recorded occurrences in Türkiye (check GBIF or iNaturalist).
- Every species needs both `## tr` and `## en` descriptions and `habitat`. Write natural Turkish,
  not a word-for-word translation.
- `edibility` must follow reliable mycological sources. When in doubt, choose the more cautious
  value. Never describe a species as edible if any reliable source calls it toxic.
- Add `lookalikes` for every species that can be confused with a toxic or deadly one, with a note
  on how to tell them apart.
- Only use photos you took yourself or that are CC0 / CC-BY / CC-BY-SA, and credit the author,
  licence and source URL. Resize to about 1600px wide, WebP, a few hundred KB.
- Don't invent facts, sources or photo credits.

## Workflow

```sh
gh repo fork tzercin/mushroom --clone && cd mushroom
git checkout -b add-<species-id>        # one topic per branch
npm install
# … make the change …
npm run fetch:occurrences -- <species-id>   # for a new species: downloads its GBIF records
npm run build                               # must pass: validates content and typechecks
```

Then open the pull request against `master`:

```sh
git push -u origin HEAD
gh pr create --repo tzercin/mushroom --base master --fill
```

## Pull request checklist

- Keep it focused: one species or one fix per PR, no unrelated formatting or dependency changes.
- Don't touch `wrangler.jsonc`, `public/_headers`, `package.json`, `package-lock.json`, deployment
  settings or GitHub workflows unless the PR is specifically about them.
- Never commit `.env` files, tokens or other credentials.
- In the PR description, list the sources for the facts you added (edibility, distribution) and
  the licence of every photo, and say that `npm run build` passes.
- If an AI agent wrote the change, say so. That's fine; a human should still have read it.
