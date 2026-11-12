import { Octokit } from "@octokit/rest";

const MAX_KEY_FILES = 8;
const MAX_FILE_CHARS = 4_000;
const MAX_README_CHARS = 6_000;
const MAX_TREE_ENTRIES = 200;
const MAX_FILE_BYTES = 60_000;

export type RepoContext = {
  owner: string;
  repo: string;
  ref: string;
  description: string | null;
  readme: string | null;
  tree: string[];
  treeTruncated: boolean;
  files: { path: string; content: string; truncated: boolean }[];
};

export function parseGitHubUrl(url: string) {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    throw new Error(`Not a valid URL: ${url}`);
  }
  if (parsed.hostname !== "github.com" && parsed.hostname !== "www.github.com") {
    throw new Error("Only github.com repository URLs are supported");
  }
  const [owner, rawRepo, kind, ...rest] = parsed.pathname
    .split("/")
    .filter(Boolean);
  if (!owner || !rawRepo) throw new Error(`Not a repository URL: ${url}`);
  return {
    owner,
    repo: rawRepo.replace(/\.git$/, ""),
    // .../tree/<ref>: branch names containing "/" are not supported here.
    ref: kind === "tree" && rest[0] ? rest[0] : undefined,
  };
}

const SKIP =
  /(^|\/)(node_modules|dist|build|out|vendor|coverage|\.next|\.git|__pycache__)\/|\.(png|jpe?g|gif|svg|ico|webp|pdf|zip|gz|woff2?|ttf|eot|mp4|mp3|lock|min\.js|map)$|(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml)$/i;

const MANIFEST =
  /^(package\.json|requirements\.txt|pyproject\.toml|go\.mod|Cargo\.toml|pom\.xml|build\.gradle(\.kts)?|Gemfile|composer\.json)$/i;
const ENTRY =
  /(^|\/)(index|main|app|server|page|layout|route|cli)\.(ts|tsx|js|jsx|mjs|py|go|rs|java|rb|php)$/i;
const TEST = /(^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\.[a-z]+$/i;
// Web files count as source too: many deliverables are front-end only.
const SOURCE =
  /\.(ts|tsx|js|jsx|mjs|py|go|rs|java|kt|rb|php|cs|c|cpp|swift|sql|prisma|html?|css|scss|vue|svelte|astro)$/i;

/** Lower score = more useful for judging a deliverable. */
function score(path: string): number {
  const depth = path.split("/").length - 1;
  if (MANIFEST.test(path)) return 0;
  if (ENTRY.test(path)) return 10 + depth;
  if (TEST.test(path)) return 30 + depth;
  if (SOURCE.test(path)) return 40 + depth;
  return 100 + depth;
}

function truncate(text: string, max: number) {
  return text.length > max
    ? { content: `${text.slice(0, max)}\n... [truncated]`, truncated: true }
    : { content: text, truncated: false };
}

/**
 * Fetch a compact snapshot of a GitHub repo for the AI Reviewer:
 * README, file tree, and up to 8 key files, all truncated to stay small.
 */
export async function fetchRepoContext(url: string): Promise<RepoContext> {
  const { owner, repo, ref: urlRef } = parseGitHubUrl(url);
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN || undefined });

  const { data: repoData } = await octokit.rest.repos.get({ owner, repo });
  const ref = urlRef ?? repoData.default_branch;

  const readmePromise = octokit.rest.repos
    .getReadme({ owner, repo, ref, mediaType: { format: "raw" } })
    .then((r) => truncate(String(r.data), MAX_README_CHARS).content)
    .catch(() => null);

  const { data: treeData } = await octokit.rest.git.getTree({
    owner,
    repo,
    tree_sha: ref,
    recursive: "true",
  });

  const blobs = treeData.tree.filter(
    (e) => e.type === "blob" && e.path && !SKIP.test(e.path),
  );
  const paths = blobs.map((e) => e.path as string);

  const keyPaths = blobs
    .filter(
      (e) =>
        (e.size ?? 0) <= MAX_FILE_BYTES &&
        !/^readme(\.[a-z]+)?$/i.test(e.path as string) &&
        score(e.path as string) < 100,
    )
    .map((e) => e.path as string)
    .sort((a, b) => score(a) - score(b) || a.localeCompare(b))
    .slice(0, MAX_KEY_FILES);

  const [readme, files] = await Promise.all([
    readmePromise,
    Promise.all(
      keyPaths.map(async (path) => {
        try {
          const { data } = await octokit.rest.repos.getContent({
            owner,
            repo,
            path,
            ref,
            mediaType: { format: "raw" },
          });
          return { path, ...truncate(String(data), MAX_FILE_CHARS) };
        } catch {
          return null;
        }
      }),
    ),
  ]);

  return {
    owner,
    repo,
    ref,
    description: repoData.description,
    readme,
    tree: paths.slice(0, MAX_TREE_ENTRIES),
    treeTruncated: paths.length > MAX_TREE_ENTRIES || treeData.truncated === true,
    files: files.filter((f) => f !== null),
  };
}
