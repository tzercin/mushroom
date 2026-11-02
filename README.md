# mushroom

Türkiye'deki mantar çeşitliliği haritası — an interactive 3D map of the evolutionary
relationships between mushrooms found in Türkiye, drawn as a glowing mycelium network.
Live at **https://mushroom.turkerziyaercin.com** (Cloudflare).

## Stack

- **Vite + React + TypeScript**: a static single-page app with no server.
- **three.js** via **@react-three/fiber**, **drei** (camera controls, HTML labels, spores)
  and **@react-three/postprocessing** (bloom, vignette, grain).
- **zustand** for state, **i18next** for Turkish/English, **fuse.js** for search, **Tailwind CSS**.
- The URL mirrors the selection (`/amanita-phalloides`, `/agaricales`), so every view can be shared.

## Development

```sh
npm install
npm run dev        # builds the data, then starts Vite on http://localhost:5173
npm run build      # data + typecheck + production build into dist/
npm run preview    # serve dist/ locally
```

## Content

All content lives in git and is compiled to static JSON by `scripts/build-data.ts`
(which runs automatically before `dev` and `build`):

| Source | What |
|---|---|
| `content/tree/clades.yml` | The tree above species: kingdom → phylum → class → order → family → genus |
| `content/clades/<id>.md` | One file per clade (kingdom to genus): a `## tr` and a `## en` description |
| `content/species/<id>.md` | One file per species: details in the header block, then `## tr` and `## en` descriptions |
| `content/distribution/<id>.json` | GBIF records of the species in Türkiye (generated, see [Distribution maps](#distribution-maps)) |
| `content/geo/provinces.json` | The 81 province boundaries, simplified (generated) |
| `content/geo/world.json` | Country boundaries for the world map (generated) |

The script validates everything (with zod), attaches species to their `parent` genus,
computes a deterministic 3D layout (radial tree, then a d3-force-3d relaxation), assigns
lineage colours, and writes:

- `public/data/tree.json`: every node with its position. The app loads this on start.
- `public/data/species/<id>.json`: details for one species, fetched when it's opened.
- `public/data/clades/<id>.json`: the description of one clade, fetched when it's opened.
- `public/data/turkey.json` and `world.json`: the two maps as SVG paths, fetched when first shown.

When you add a clade to `clades.yml`, also add `content/clades/<id>.md` (the build warns if one is
missing). To add a species, copy an existing `.md` file, change the `id` (it must match the file name)
and `parent`, and run `npm run data`. Clades without any species are hidden automatically.

`edibility` is one of `edible`, `edible-caution`, `medicinal`, `inedible`, `toxic` or `deadly`.

`lookalikes` lists the species it can be confused with, each with a `note` (`tr` and `en`) on how to
tell them apart. Refer to a species in the network by `id`; the link works both ways, so the other
species shows it too without repeating it. A species outside the network takes a `latin` name,
optional `tr`/`en` common names and its `edibility`:

```yaml
lookalikes:
  - id: agaricus-campestris
    note: { tr: "…", en: "…" }
  - latin: Omphalotus olearius
    en: "Jack-o’-lantern mushroom"
    edibility: toxic
    note: { tr: "…", en: "…" }
```

`look` sets how the species is drawn in 3D on the tree. `form` picks a procedural model (see
`FORMS` in `src/data/types.ts` and the builders in `src/scene/forms.ts`): `cap`, `parasol`,
`shaggy`, `bolete`, `funnel`, `teeth`, `spines`, `bracket`, `shelves`, `oyster`, `morel`, `thimble`,
`brain`, `puffball`, `truffle`, `club` or `ear`. `color` (optional, `#rrggbb`) tints the cap,
and `spots: true` adds white warts or scales. The stem and rim glow keep the lineage colour.

```yaml
look:
  form: cap
  color: "#e8382c"
  spots: true
```

## Distribution maps

The species panel shows where the species has been recorded in Türkiye: one dot per place
with a [GBIF](https://www.gbif.org) record (mostly iNaturalist observations and herbarium
specimens), with the provinces that have records tinted. These are records, not the
species' full range, and many species have only a few records so far.

A **World** tab tints each country by its number of GBIF records for the species (log scale),
with Türkiye outlined. Keeping every point worldwide would mean hundreds of thousands per
species, so only the count per country is kept. These counts follow how many people record
fungi in a country more than how common the species is there.

The records are downloaded once and committed, so the build itself never goes online:

```sh
npm run fetch:occurrences                    # all species: writes content/distribution/<id>.json
npm run fetch:occurrences -- boletus-edulis  # only some
npm run fetch:provinces                      # province boundaries (rarely needed)
npm run fetch:world                          # country boundaries (rarely needed)
```

Run `fetch:occurrences` after adding a species, and now and then to pick up new records. Then
review the diff and commit. Records with a location uncertainty over 25 km or placeholder
whole-degree coordinates are skipped, and records within ~1 km of each other become one dot.
The build works out which province each dot falls in.

Province boundaries come from [geoBoundaries](https://www.geoboundaries.org) (OpenStreetMap
data, CC BY-SA 2.0), credited under the map. Country boundaries come from
[Natural Earth](https://www.naturalearthdata.com) 1:110m (public domain), drawn in the
Equal Earth projection. Very small territories (Andorra, the Isle of Man, …) are too small to
appear at that scale, but their records still count in the totals.

## Photos

Photos live in git under `public/photos/` and are deployed with the site as static assets
(free and unlimited on Workers). The app loads them from `VITE_IMAGE_BASE_URL`
(copy `.env.example` to `.env`; defaults to `/photos`).

1. Put the photo in a folder named after the species id:
   `public/photos/amanita-muscaria/01.webp` (then `02.webp`, …). Paths are case-sensitive.
2. Reference the photo in the species file. The author and licence are required, and the app
   shows the credit under the photo:

   ```yaml
   photos:
     - file: amanita-muscaria/01.webp
       author: "Jane Doe"
       license: CC-BY-4.0
       source: https://www.inaturalist.org/observations/12345
   ```

Only use photos whose licence allows it (your own, or CC-BY / CC-BY-SA / CC0, e.g. from
iNaturalist, GBIF or Wikimedia Commons). Pre-resize photos (around 1600px wide, WebP/AVIF,
a few hundred KB) before committing. Species without photos show a placeholder.
Only the first photo is shown for now.

To move photos to a bucket later (e.g. Cloudflare R2), upload the contents of
`public/photos/` with the same paths and point `VITE_IMAGE_BASE_URL` at the bucket's URL.

## Deployment (Cloudflare Workers, static assets)

`wrangler.jsonc` deploys `dist/` as a static-assets Worker. Unknown paths fall back to
`index.html`, so deep links work, and `mushroom.turkerziyaercin.com` is attached as a custom
domain. This is free on the Workers free plan.

```sh
npx wrangler login
npm run deploy
```

Alternatively, connect the GitHub repo under **Workers & Pages → Create → Import a repository**
with build command `npm run build`. Every push then deploys, and pull requests get preview URLs.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Changes come in as pull requests and are reviewed before merging.

## Disclaimer

This site is for education only. Never eat a wild mushroom based on this site.
