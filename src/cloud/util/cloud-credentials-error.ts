/**
 * Thrown by aws/instances-cli.ts and gcp/instances-cli.ts when a cloud's
 * credentials can't be used at all (not logged in, stale login, no access to
 * the project), as opposed to an API call failing after credentials checked
 * out. Lets cloud-instances.ts treat "you're not set up for this cloud" as a
 * skip rather than a failure — see shouldSkipUnusableCloud.
 */
export class CloudCredentialsError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "CloudCredentialsError";
  }
}

/**
 * Whether a per-cloud failure under `--cloud all` should be downgraded to a
 * warning. Only unusable credentials qualify, and only off GHA: plenty of
 * users only ever use one cloud and shouldn't see `cloud-instances remove-all`
 * fail for the other, but CI is always set up for both, so there it means
 * something is broken and the scheduled cleanup must fail loudly.
 * An explicitly requested cloud (`--cloud aws|gcp`) never gets here.
 */
export function shouldSkipUnusableCloud(err: unknown, env: NodeJS.ProcessEnv = process.env): boolean {
  return err instanceof CloudCredentialsError && env.GITHUB_ACTIONS !== "true";
}
