import { Octokit } from "@octokit/rest"
import * as fs from "fs/promises"

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || ""
const octokit = new Octokit({ auth: GITHUB_TOKEN })

async function getRepoInfo(
  owner: string,
  repo: string
): Promise<{ version: string; lastCommitTime: string } | null> {
  try {
    // Get package.json content
    const { data: packageJson } = await octokit.repos.getContent({
      owner,
      repo,
      path: "package.json",
    })

    if (!("content" in packageJson)) {
      console.error(`No package.json found in ${owner}/${repo}`)
      return null
    }

    const content = Buffer.from(packageJson.content, "base64").toString()
    const { version } = JSON.parse(content)

    // Get commits from the past week
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

    const { data: commits } = await octokit.repos.listCommits({
      owner,
      repo,
      since: oneWeekAgo.toISOString(),
      per_page: 100, // Increase this if you expect more than 100 commits in a week
    })

    if (commits.length === 0) {
      console.log(`No commits in the past week for ${owner}/${repo}`)
      return null
    }

    // Use the most recent commit timestamp
    const lastCommitTime = commits[0].commit.committer?.date || "Unknown"

    return { version, lastCommitTime }
  } catch (error) {
    console.error(`Error fetching info for ${owner}/${repo}:`, error)
    return null
  }
}

async function generateMermaidChart(
  repoData: { repo: string; version: string; lastCommitTime: string }[]
): string {
  const mermaidHeader =
    "```mermaid\ngantt\n  dateFormat  YYYY-MM-DD HH:mm:ss\n  title Repository Versions and Last Commit Times (Past Week)\n  axisFormat %Y-%m-%d %H:%M\n\n"

  const chartContent = repoData
    .map(({ repo, version, lastCommitTime }) => {
      const date = new Date(lastCommitTime)
      const formattedDate = date.toISOString().replace("T", " ").slice(0, 19)
      return `  ${repo} v${version} : milestone, ${formattedDate}, 1s`
    })
    .join("\n")

  return mermaidHeader + chartContent + "\n```\n"
}

async function main() {
  const repoUrls = [
    "https://github.com/tscircuit/tscircuit",
    "https://github.com/tscircuit/cli",
    "https://github.com/tscircuit/react-fiber",
    "https://github.com/tscircuit/builder",
    "https://github.com/tscircuit/schematic-viewer",
    "https://github.com/tscircuit/pcb-viewer",
    "https://github.com/tscircuit/3d-viewer",
    "https://github.com/tscircuit/soup",
    "https://github.com/tscircuit/props",
  ]

  const repoData = []

  for (const url of repoUrls) {
    const [, owner, repo] = url.match(/github\.com\/([^\/]+)\/([^\/]+)/) || []
    if (owner && repo) {
      const info = await getRepoInfo(owner, repo)
      if (info) {
        repoData.push({ repo: `${owner}/${repo}`, ...info })
      }
    }
  }

  const mermaidChart = await generateMermaidChart(repoData)
  await fs.writeFile("README.md", mermaidChart)
  console.log("Chart generated and saved to README.md")
}

main().catch(console.error)
