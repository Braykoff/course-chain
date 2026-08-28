This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Project data format

Course-chain projects are stored as [Protobuf](https://protobuf.dev). The schema
lives in `proto/coursechain/v1/course_chain.proto`; `CourseChainProject` is the
top-level message written to and read from files and IndexedDB.

- `npm run gen:proto` regenerates the TypeScript bindings into `src/lib/gen/`
  (via [`buf`](https://buf.build) + `protoc-gen-es`). The generated output is
  committed, so `npm run build` and CI don't need `buf`. **Re-run it after
  editing any `.proto`** and commit the result.
- `npm run lint:proto` runs `buf lint`.
- `src/lib/project/` is the library the app imports (`@/lib/project`): the
  generated types, `serializeProject` / `deserializeProject`, and
  `validateProject`. Both serialize and deserialize run `validateProject`, which
  checks the schema version, name lengths (project/track ≤ 100, term ≤ 40),
  non-blank/unique/1–100 term names, term ordering, ≤ 10 unique non-blank track
  names, case-insensitively unique course names, term-number bounds, per-term
  slot uniqueness (≤ 50), prereq references, and prereq-graph acyclicity — so an
  invalid project is never persisted or handed to the UI.
- `src/lib/onboarding/` backs the "New course-chain Project" dialog: the form
  draft model, `validateDraft` (the same rules, phrased for the form),
  `draftToProject`, and `buildTemplateTerms` for the "Template" dropdown.
- `src/lib/storage/` mirrors every project to `localStorage`, keyed by its
  UUID (`projectId`), as base64 protobuf. The editor autosaves on every change
  and stamps `lastModified`. The top bar's download button exports the project
  as a **`.chain`** file (raw protobuf); "Open File" imports one, prompting when
  a project with the same id is already stored so you can pick the newer copy.
- The top bar's PDF button rasterizes the full-size calendar board (columns +
  prereq arrows) with `html-to-image` and wraps it in a one-page, pixel-exact
  PDF via `jspdf` (both dynamically imported). No print dialog.
- `npm run tests` (or `npm test`) runs the Vitest suite in `tests/`:
  serialize/deserialize round trips, every validation failure path, the
  onboarding draft/template logic, course operations, and storage.
  `npm run test:watch` for watch mode.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deployment

The site is built as a fully static export and published to GitHub Pages at
**https://raykoff.org/course-chain/**.

- `.github/workflows/deploy.yml` runs on every push to `main`: it installs
  dependencies, runs `npm run build` (`output: "export"` writes `./out`), adds a
  `.nojekyll` marker, and deploys the `out/` directory with `actions/deploy-pages`.
- `next.config.ts` sets `basePath: "/course-chain"` so all routes and `_next`
  assets resolve under the sub-path. Next rewrites `<Link>` hrefs and its own
  asset URLs automatically; string references to files in `public/` (e.g.
  `next/image` `src`) need the prefix applied by hand — re-export `basePath` as
  `NEXT_PUBLIC_BASE_PATH` via the `env` config key when that comes up.
- One-time repo setup: **Settings → Pages → Build and deployment → Source =
  "GitHub Actions"**. The `raykoff.org` custom domain is configured on the user
  Pages site, not this repo, so no `CNAME` file is needed here.

To preview the production build locally:

```bash
npm run build
npx serve out -l 3000
# then open http://localhost:3000/course-chain/
```
