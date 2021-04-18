# Profile Readme Stats

Showcase your github stats on your profile README.md.

This action provides [template strings](#template-strings) that are replaced with their respective values when the action runs.

**Example:** [TEMPLATE](./TEMPLATE.md?raw=true) → [README](./OUTPUT.md)

## Table of contents

<!-- prettier-ignore-start -->
- [Profile Readme Stats](#profile-readme-stats)
  - [Table of contents](#table-of-contents)
  - [Action Inputs](#action-inputs)
    - [`token`](#token)
    - [`template`](#template)
    - [`readme`](#readme)
    - [`includeForks`](#includeforks)
  - [Template Strings](#template-strings)
    - [General](#general)
      - [`{{ ACCOUNT_AGE }}`](#-account_age-)
      - [`{{ ISSUES }}`](#-issues-)
      - [`{{ PULL_REQUESTS }}`](#-pull_requests-)
      - [`{{ COMMITS }}`](#-commits-)
      - [`{{ GISTS }}`](#-gists-)
      - [`{{ REPOSITORIES }}`](#-repositories-)
      - [`{{ REPOSITORIES_CONTRIBUTED_TO }}`](#-repositories_contributed_to-)
      - [`{{ STARS }}`](#-stars-)
    - [Languages](#languages)
      - [`{{ LANGUAGE_TEMPLATE_START }}`](#-language_template_start-)
      - [`{{ LANGUAGE_NAME }}`](#-language_name-)
      - [`{{ LANGUAGE_PERCENT }}`](#-language_percent-)
      - [`{{ LANGUAGE_COLOR }}`](#-language_color-)
      - [`{{ LANGUAGE_TEMPLATE_END }}`](#-language_template_end-)
    - [Extra Options](#extra-options)
      - [`uri`](#uri)
      - [`max`](#max)
  - [Example Workflow](#example-workflow)
<!-- prettier-ignore-end -->

## Action Inputs

### `token`

_Required_

Personal access token with `read:user` scope and optional `repo` scope

Generate token here: https://github.com/settings/tokens

**Note:** `repo` scope is needed for taking private repositories into account

### `template`

Path to template file (default: `./TEMPLATE.md`)

### `readme`

Path to generated file (default: `./README.md`)

### `includeForks`

Include forked repositories when calculating the stats (default: `false`)

## Template Strings

### General

#### `{{ ACCOUNT_AGE }}`

Account age in years.

#### `{{ ISSUES }}`

Total number of opened issues across all repositories.

#### `{{ PULL_REQUESTS }}`

Total number of opened pull requests across all repositories.

#### `{{ COMMITS }}`

Total number of commits across all repositories. Includes commits in private repositories only if you allowed github to show your private contributions on your profile (check out this [link](https://docs.github.com/en/github/setting-up-and-managing-your-github-profile/publicizing-or-hiding-your-private-contributions-on-your-profile#changing-the-visibility-of-your-private-contributions) for more info).

#### `{{ GISTS }}`

Total number of public gists.

#### `{{ REPOSITORIES }}`

Total number of repositories. Includes private repositories if the given personal access token has `repo` scope (see more [here](#token)).

#### `{{ REPOSITORIES_CONTRIBUTED_TO }}`

Total number of repositories you contributed to.

#### `{{ STARS }}`

Total number of stars on all your gists and repositories.

### Languages

A region that will be repeated for every language you use in your repositories.

#### `{{ LANGUAGE_TEMPLATE_START }}`

Special template string that signifies the start of the region.

#### `{{ LANGUAGE_NAME }}`

Name of the language.

#### `{{ LANGUAGE_PERCENT }}`

How often the language is used in your repositories (percentage wise).

#### `{{ LANGUAGE_COLOR }}`

Color of the language (in CSS color format ex: `#0248AC`).

#### `{{ LANGUAGE_TEMPLATE_END }}`

Special template string that signifies the end of the region.

### Extra Options

#### `uri`

Will encode the value as an URI component

**Example:**

```
{{ LANGUAGE_COLOR:uri }}
```

#### `max`

Can only be used with `LANGUAGE_TEMPLATE_START`

Will run the inner template at most `max` nr of times

**Example:**

```
{{ LANGUAGE_TEMPLATE_START:max=5 }}
This text will be printed at most 5 times
{{ LANGUAGE_TEMPLATE_END }}
```

## Example Workflow

<!-- prettier-ignore-start -->
```yml
on:
  schedule:
    - cron: '0 */12 * * *' # every 12 hours
  push:
    branches:
      - master
      - main
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
      with:
        fetch-depth: 0
    - name: Generate README.md
      uses: teoxoy/profile-readme-stats@v1
      with:
        token: ${{ secrets.USER_TOKEN }}
    - name: Update README.md
      run: |
        if [[ "$(git status --porcelain)" != "" ]]; then
        git config user.name github-actions[bot]
        git config user.email 41898282+github-actions[bot]@users.noreply.github.com
        git add .
        git commit -m "Update README"
        git push
        fi
```
<!-- prettier-ignore-end -->
