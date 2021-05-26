import { promises as fs } from 'fs'
import * as core from '@actions/core'
import { graphql } from '@octokit/graphql'

/** template strings */
enum TPL_STR {
    LANGUAGE_TEMPLATE_START = 'LANGUAGE_TEMPLATE_START',
    LANGUAGE_TEMPLATE_END = 'LANGUAGE_TEMPLATE_END',
    LANGUAGE_NAME = 'LANGUAGE_NAME',
    LANGUAGE_PERCENT = 'LANGUAGE_PERCENT',
    LANGUAGE_COLOR = 'LANGUAGE_COLOR',
    ACCOUNT_AGE = 'ACCOUNT_AGE',
    ISSUES = 'ISSUES',
    PULL_REQUESTS = 'PULL_REQUESTS',
    CODE_REVIEWS = 'CODE_REVIEWS',
    COMMITS = 'COMMITS',
    GISTS = 'GISTS',
    REPOSITORIES = 'REPOSITORIES',
    REPOSITORIES_CONTRIBUTED_TO = 'REPOSITORIES_CONTRIBUTED_TO',
    STARS = 'STARS',
}

run().catch(error => core.setFailed(error.message))

async function run(): Promise<void> {
    const token = core.getInput('token')
    const template = core.getInput('template')
    const readme = core.getInput('readme')
    const includeForks = core.getInput('includeForks') === 'true'

    const gql = graphql.defaults({
        headers: { authorization: `token ${token}` },
    })

    const {
        accountAge,
        issues,
        pullRequests,
        contributionYears,
        gists,
        repositories,
        repositoryNodes,
        repositoriesContributedTo,
        stars,
    } = await getUserInfo(gql, includeForks)

    const totalCommits = await getTotalCommits(gql, contributionYears)
    const totalReviews = await getTotalReviews(gql, contributionYears)

    let o = await fs.readFile(template, { encoding: 'utf8' })
    o = replaceLanguageTemplate(o, repositoryNodes)
    o = replaceStringTemplate(o, TPL_STR.ACCOUNT_AGE, accountAge)
    o = replaceStringTemplate(o, TPL_STR.ISSUES, issues)
    o = replaceStringTemplate(o, TPL_STR.PULL_REQUESTS, pullRequests)
    o = replaceStringTemplate(o, TPL_STR.COMMITS, totalCommits)
    o = replaceStringTemplate(o, TPL_STR.CODE_REVIEWS, totalReviews)
    o = replaceStringTemplate(o, TPL_STR.GISTS, gists)
    o = replaceStringTemplate(o, TPL_STR.REPOSITORIES, repositories)
    o = replaceStringTemplate(
        o,
        TPL_STR.REPOSITORIES_CONTRIBUTED_TO,
        repositoriesContributedTo
    )
    o = replaceStringTemplate(o, TPL_STR.STARS, stars)
    await fs.writeFile(readme, o)
}

interface Starrable {
    stargazers: {
        totalCount: number
    }
}

interface Gist extends Starrable {}

interface Repository extends Starrable {
    languages: {
        edges: Array<{
            size: number
            node: {
                color?: string
                name: string
            }
        }>
    }
}

async function getUserInfo(gql: typeof graphql, includeForks = false) {
    const query = `{
        viewer {
            createdAt
            issues {
                totalCount
            }
            pullRequests {
                totalCount
            }
            contributionsCollection {
                contributionYears
            }
            gists(first: 100) {
                totalCount
                nodes {
                    stargazers {
                        totalCount
                    }
                }
            }
            repositories(affiliations: OWNER, isFork: ${includeForks}, first: 100) {
                totalCount
                nodes {
                    stargazers {
                        totalCount
                    }
                    languages(first: 100) {
                        edges {
                            size
                            node {
                                color
                                name
                            }
                        }
                    }
                }
            }
            repositoriesContributedTo {
                totalCount
            }
        }
        rateLimit { cost remaining resetAt }
    }`

    interface Result {
        viewer: {
            createdAt: string
            issues: {
                totalCount: number
            }
            pullRequests: {
                totalCount: number
            }
            contributionsCollection: {
                contributionYears: number[]
            }
            gists: {
                totalCount: number
                nodes: Gist[]
            }
            repositories: {
                totalCount: number
                nodes: Repository[]
            }
            repositoriesContributedTo: {
                totalCount: number
            }
        }
    }

    const {
        viewer: {
            createdAt,
            issues,
            pullRequests,
            contributionsCollection: { contributionYears },
            gists,
            repositories,
            repositoriesContributedTo,
        },
    } = await gql<Result>(query)

    const accountAgeMS = Date.now() - new Date(createdAt).getTime()
    const accountAge = Math.floor(accountAgeMS / (1000 * 60 * 60 * 24 * 365.25))

    const stars = [...gists.nodes, ...repositories.nodes]
        .map(gist => gist.stargazers.totalCount)
        .reduce((total, current) => total + current, 0)

    return {
        accountAge,
        issues: issues.totalCount,
        pullRequests: pullRequests.totalCount,
        contributionYears,
        gists: gists.totalCount,
        repositories: repositories.totalCount,
        repositoryNodes: repositories.nodes,
        repositoriesContributedTo: repositoriesContributedTo.totalCount,
        stars,
    }
}

async function getTotalCommits(
    gql: typeof graphql,
    contributionYears: number[]
) {
    let query = '{viewer{'
    for (const year of contributionYears) {
        query += `_${year}: contributionsCollection(from: "${getDateTime(
            year
        )}") { totalCommitContributions }`
    }
    query += '}}'

    interface Result {
        viewer: Record<string, { totalCommitContributions: number }>
    }

    const result = await gql<Result>(query)
    return Object.keys(result.viewer)
        .map(key => result.viewer[key].totalCommitContributions)
        .reduce((total, current) => total + current, 0)
}

async function getTotalReviews(
    gql: typeof graphql,
    contributionYears: number[]
) {
    let query = '{viewer{'
    for (const year of contributionYears) {
        query += `_${year}: contributionsCollection(from: "${getDateTime(
            year
        )}") { totalPullRequestReviewContributions }`
    }
    query += '}}'

    interface Result {
        viewer: Record<string, { totalPullRequestReviewContributions: number }>
    }

    const result = await gql<Result>(query)
    return Object.keys(result.viewer)
        .map(key => result.viewer[key].totalPullRequestReviewContributions)
        .reduce((total, current) => total + current, 0)
}

function getDateTime(year: number) {
    const date = new Date()
    date.setUTCFullYear(year, 0, 1)
    date.setUTCHours(0, 0, 0, 0)
    return date.toISOString()
}

function buildRegex(name: TPL_STR, newLine = false) {
    let str = `\\{\\{\\s*${name}(?::(?<opts>.+?))?\\s*\\}\\}`
    if (newLine) str += '\n?'
    return new RegExp(str, 'g')
}

function getOptsMap(opts: string) {
    const opt = new Map<string, string | undefined>()
    for (const match of opts.matchAll(/(?<key>[^=;]+)(?:=(?<value>[^;]+))?/g)) {
        const key = match.groups?.key
        const value = match.groups?.value
        if (key) opt.set(key, value)
    }
    return opt
}

function replaceStringTemplate(
    input: string,
    name: TPL_STR,
    value: string | number
) {
    return input.replace(buildRegex(name), (_, opts) =>
        opts && getOptsMap(opts).has('uri')
            ? encodeURIComponent(value)
            : String(value)
    )
}

function replaceLanguageTemplate(input: string, repositories: Repository[]) {
    const rStart = buildRegex(TPL_STR.LANGUAGE_TEMPLATE_START, true)
    const rEnd = buildRegex(TPL_STR.LANGUAGE_TEMPLATE_END, true)

    const replacements = []
    for (const match of input.matchAll(rStart)) {
        if (match.index === undefined) continue
        const opts = match.groups?.opts
        const max = (opts && Number(getOptsMap(opts).get('max'))) || 8
        const end = match.index + match[0].length
        const s = input.substring(end)
        const endMatch = s.search(rEnd)
        if (endMatch === -1) continue
        const str = s.substring(0, endMatch)
        const replacement = getLanguages(repositories, max)
            .map(lang => {
                let res = str
                res = replaceStringTemplate(
                    res,
                    TPL_STR.LANGUAGE_NAME,
                    lang.name
                )
                res = replaceStringTemplate(
                    res,
                    TPL_STR.LANGUAGE_PERCENT,
                    lang.percent
                )
                res = replaceStringTemplate(
                    res,
                    TPL_STR.LANGUAGE_COLOR,
                    lang.color
                )
                return res
            })
            .reduce((acc, parts) => acc + parts, '')
        replacements.push({
            start: end,
            end: end + endMatch,
            replacement,
        })
    }

    let output = ''
    let start = 0
    for (const replacement of replacements) {
        output += input.substring(start, replacement.start)
        output += replacement.replacement
        start = replacement.end
    }
    output += input.substring(start, input.length)
    output = output.replace(rStart, '').replace(rEnd, '')
    return output
}

function getLanguages(repositories: Repository[], max: number) {
    interface Language {
        name: string
        size: number
        percent: number
        color: string
    }

    const languages = new Map<string, Language>()

    for (const repo of repositories) {
        for (const lang of repo.languages.edges) {
            const existing = languages.get(lang.node.name)
            if (existing) {
                existing.size += lang.size
            } else {
                languages.set(lang.node.name, {
                    name: lang.node.name,
                    size: lang.size,
                    percent: 0,
                    color: lang.node.color || '#ededed',
                })
            }
        }
    }

    const langs = [...languages.values()].sort((a, b) => b.size - a.size)
    const totalSize = langs.reduce((acc, lang) => acc + lang.size, 0)
    /** rounds x to 1 decimal place */
    const round = (x: number) => Math.floor(x * 10) / 10
    const getPercent = (size: number) => round((size / totalSize) * 100)
    for (const lang of langs) {
        lang.percent = getPercent(lang.size)
    }

    let maxLanguages = max

    // adjust maxLanguages based on languages that are under 0.1%
    const index = langs.findIndex(lang => lang.percent === 0)
    if (index !== -1) {
        maxLanguages = Math.min(maxLanguages, index + 1)
    }

    // aggregate removed languages under 'Other'
    if (maxLanguages < langs.length) {
        const size = langs
            .splice(maxLanguages - 1)
            .reduce((acc, lang) => acc + lang.size, 0)
        const percent = getPercent(size)

        if (percent !== 0) {
            langs.push({
                name: 'Other',
                size,
                percent,
                color: '#ededed',
            })
        }
    }

    return langs
}
