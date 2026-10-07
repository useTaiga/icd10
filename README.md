# @usetaiga/icd10cm

Official US ICD-10-CM diagnosis codes and descriptions for TypeScript and
JavaScript. Offline, zero runtime dependencies, with dated releases and a daily
CMS update check.

The initial catalog includes FY2027 (effective October 1, 2026), plus the
October 2025 and April 2026 FY2026 releases. Each includes every order-file
entry, including non-billable category headers, short descriptions, long
descriptions, and the official validity flag. Earlier releases are not bundled.

## Install

Once the first npm release is published:

```sh
npm install @usetaiga/icd10cm
```

ES modules, Node 22+, Bun, and bundlers that support JSON import attributes.

## Look up a diagnosis

```ts
import { latest } from "@usetaiga/icd10cm";

latest.lookup("B35.1");
// { code: "B35.1", shortDescription: "Tinea unguium",
//   description: "Tinea unguium", billable: true }

latest.lookup(" m2042 ")?.description;
// "Other hammer toe(s) (acquired), left foot"

latest.isBillable("A00"); // false: a category header
latest.lookup("ZZZ.999"); // undefined
latest.search("hammer toe", { limit: 10 });
```

Lookups accept dotted or undotted codes and ignore surrounding whitespace and
case. Search ranks exact code matches first, then code prefixes, then
description matches. Search returns billable codes by default; pass
`billableOnly: false` to include headers. `limit` must be a positive integer.

## Select by service or discharge date

```ts
import { getCatalogForDate, catalogs, type ReleaseId } from "@usetaiga/icd10cm";

const catalog = getCatalogForDate("2026-09-30");
catalog.release.id; // "2026-04-01", FY2026
catalog.lookup("B35.1");

const release: ReleaseId = "2026-10-01";
catalogs[release].release.fiscalYear; // 2027
```

Dates are strict `YYYY-MM-DD` strings. Invalid dates and dates outside the
bundled effective periods throw `RangeError`. There is no fallback to a newer
release. `latest` means the newest **published** catalog, which may be released
before its effective date. Use `getCatalogForDate` when the applicable release
depends on a service or discharge date.

Fiscal year alone is insufficient: the April and October snapshots remain
separate, even when their codes are identical. An April release shortens the
preceding October release's effective period.

## Import one release or raw data

The root import loads all bundled releases. Use a release subpath to load only
one snapshot:

```ts
import { catalog } from "@usetaiga/icd10cm/releases/2026-10-01";
catalog.lookup("B35.1");
```

Raw JSON is available at `@usetaiga/icd10cm/data/2026-10-01` (use a JSON import
attribute in Node). It maps dotted codes to
`[shortDescription, description, billable]`. The release manifest is available
at `@usetaiga/icd10cm/data/releases`.

## Development

```sh
bun install --frozen-lockfile
bun run update  # fetch the CMS release page and full ZIP archives
bun run check   # types, tests, build, and an installed-tarball check
npm pack --dry-run
```

`src/data` holds committed snapshots and provenance. The build generates typed
entry points from the manifest. Generated source, build output, and the local
update report are ignored. Runtime code never contacts CMS.

The importer discovers October and April releases from the official CMS page,
rejects malformed or duplicate rows and suspiciously small catalogs, and
cross-checks every billable entry against the separate official code list. It
prepares all downloads before writing snapshots. Source layout changes fail the
job for maintainer review. `UPDATE.md` describes changes against the committed
snapshots; counts include headers and billability changes.

## Automation and first publication

`update.yml` checks CMS daily and opens or updates a PR when data or provenance
changes. The PR bumps the patch version and includes a change report. New code
releases and corrections are patch updates; incompatible API changes need a
major version. Merge a verified update to publish it automatically.

The scheduled job also re-enables its own schedule through GitHub's API to
prevent the [60-day inactivity cutoff](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows)
between code releases.

One-time setup:

1. Set an `UPDATE_TOKEN` secret using a bot's fine-grained GitHub token scoped
   to this repository, with contents and pull-request write permissions. This
   lets update PRs trigger CI. Alternatively, allow GitHub Actions to create
   pull requests in the organization and repository's **Settings → Actions →
   General**. The `useTaiga` organization currently disables that default-token
   permission, and a repository setting cannot override it. Without a bot
   token or the organization change, release checks run but opening update PRs
   is blocked. With the default token, updates are verified in the updater
   workflow, but separate PR workflows do not trigger.
2. Publish version 1.0.0 from an npm account allowed to publish under
   `@usetaiga`: `npm login`, `bun run check`, then
   `npm publish --access public --provenance=false`. The initial publication
   may require npm's interactive two-factor authentication.
3. In the npm package's **Trusted Publisher** settings, authorize GitHub
   organization `useTaiga`, repository `icd10`, workflow `publish.yml`, with
   direct publishing allowed. The workflow uses OIDC, so no long-lived npm
   token is needed.
4. Set the GitHub Actions repository variable `NPM_PUBLISH_ENABLED` to `true`
   and run **Publish npm package** once. It skips already published versions;
   subsequent merges with new versions publish with provenance.

The publish job remains disabled until setup is complete. Failed imports or
checks cannot publish. Review update PRs before merging, and subscribe to
workflow failure notifications. Updating this package does not upgrade
consuming applications; they need dependency updates too.

See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) and
[data attribution](NOTICE.md). This package supplies descriptions and valid
submission codes, not payer coverage or a full clinical coding-rule engine.
