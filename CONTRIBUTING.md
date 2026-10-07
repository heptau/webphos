# Contributing to WebPhos

WebPhos (formerly miniPaint) is a web image editor written in vanilla JS with
HTML5 canvas, no framework. We love your input! We want to make contributing
as easy and transparent as possible, whether it's:

- Reporting a bug
- Asking questions
- Discussing the current state of the code
- Submitting a fix
- Proposing new features

## AI-Assisted Development

Large parts of this project's code and documentation are developed with the
assistance of AI/LLM tools (e.g. Claude). Every change is reviewed by a human
maintainer before it's merged or released. Notes for AI agents are in
[AGENTS.md](AGENTS.md).

## We Develop with GitHub

We use GitHub to host code, to track issues and feature requests, as well as
accept pull requests.

1. Fork the repo.
2. Create a branch from `main`.
3. If you've added code that should be tested, add tests (`tests/*.test.ts`;
   keep the logic in `src/js/libs/` so it can be tested without the DOM).
4. If you've changed behavior, update the documentation (`AGENTS.md`,
   `README.md`) and add a line to `CHANGELOG.md` under `## [Unreleased]`.
5. Ensure `npm test`, `npm run lint` and `npm run typecheck` pass.
6. Issue the pull request to the `main` branch.

## Development

| Command | Purpose |
|---|---|
| `npm install` | install dependencies |
| `npm run server` (or `make dev`) | development server |
| `npm test` (or `make test`) | Jest tests |
| `npm run lint` (or `make lint`) | ESLint |
| `npm run typecheck` (or `make typecheck`) | TypeScript type check |
| `make build` | production build into `docs/` |

New texts must be translated: add them to `src/js/languages/cs.json`, run
`npm run translations:sync` and translate them to the other languages too.

## Commit messages

Commit messages are written in English and follow
[Conventional Commits](https://www.conventionalcommits.org/):
`<type>(optional scope): <imperative summary>`. Common types are `feat`, `fix`,
`docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci` and `chore`; mark
breaking changes with `!` after the type (`feat!: ...`). Examples:

- `feat(layer): add Layer Mask commands to the Layer menu`
- `fix(text): keep text color instead of reverting to the default`
- `ci: audit only production dependencies`

## Code Style

Follow the surrounding code: tabs for indentation, no framework, no new
dependencies without a good reason. User input from URLs and files must be
validated (`libs/input-validator.js`, `libs/url-validator.js`), and no data is
sent to any server (privacy first). Never put personal data of customers
(PII) into code, tests or documentation.

## Any contributions you make will be under the MIT Software License

In short, when you submit code changes, your submissions are understood to be
under the same [MIT License](LICENSE) that covers the project. Feel free to
contact the maintainers if that's a concern.

## Versioning

The `VERSION` file in the root of the repository is the single source of truth
for the version of the application. `make build` and the webpack config read
it (the version is shown in the application), and `make build` also writes it
into `package.json`. The version of the next release is prepared in `VERSION`
in advance.

## Changelog

`CHANGELOG.md` follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and lists only what is new since version 5.0.0. Write notable changes under
`## [Unreleased]` (groups `Added`, `Changed`, `Fixed`, `Removed`). Write them
from the point of view of the user, not of the code.

## Releasing

The application is published with GitHub Pages from the `docs/` folder of the
`main` branch. `dist/` is only an intermediate build output and is not
committed.

1. Make sure `CHANGELOG.md` has real content under `## [Unreleased]` and that
   `VERSION` contains the version being released.
2. Rename `## [Unreleased]` to `## [X.Y.Z] - <date>` and add a fresh empty
   `## [Unreleased]` above it.
3. Run `npm test`, `npm run lint` and `npm run typecheck` (or `make ci`, which
   also builds).
4. Run `make build`. It cleans `dist/` and `docs/`, builds the production
   bundle and copies it to `docs/`.
5. Commit the changes including `docs/`, push, and tag the commit `vX.Y.Z`.

`docs/.well-known/security.txt` is generated too: its source is `public/.well-known/security.txt`
(edit it there and renew its `Expires` date at least once a year); `scripts/post-build.js` copies it to
`dist/` and `docs/` on every build. The same applies to `docs/CNAME` (custom domain
`webphos.80.cz` for GitHub Pages), whose source is `public/CNAME`.

Do not edit files in `docs/` by hand; their names contain hashes that change
with every build.

## Report bugs using GitHub issues

We use [GitHub issues](https://github.com/heptau/webphos/issues) to track public bugs. Report a bug by [opening a new issue](https://github.com/heptau/webphos/issues/new).

## Write bug reports with detail

**Great Bug Reports** tend to have:

- A quick summary and/or background
- WebPhos version (see *About WebPhos*) and the browser with its version
- Operating system and version
- Steps to reproduce
	- Be specific!
	- Attach a sample image or project (JSON) if you can; do not send images
	  with personal data.
- What you expected would happen
- What actually happens
- Notes (possibly including why you think this might be happening, or stuff
  you tried that didn't work)
