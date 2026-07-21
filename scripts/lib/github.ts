export async function fetchStars(repo: string, token: string, fetchFn: typeof fetch = fetch): Promise<number> {
  const res = await fetchFn(`https://api.github.com/repos/${repo}`, {
    headers: {
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'trackage',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  })
  if (!res.ok) {
    throw new Error(`github ${repo} -> ${(res as Response).status}`)
  }
  const json = await res.json() as { stargazers_count?: number }
  return json.stargazers_count ?? 0
}
