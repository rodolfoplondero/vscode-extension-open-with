# Publishing to editor marketplaces

The same verified VSIX can be published to Visual Studio Marketplace (VS Code) and Open VSX (the default registry used by VSCodium). This is separate from a GitHub release. All listing text, settings instructions, and current technical identifiers are in English.

The selected publisher is **rodolfoplondero** and the author is **Rodolfo Londero**, both configured in `package.json`. You must control this namespace in both registries. Neither a GitHub account nor ownership of this repository grants publishing rights to a registry namespace.

## Visual Studio Marketplace

1. Sign in to https://marketplace.visualstudio.com/manage and create or select publisher ID **rodolfoplondero**, with public display name **Rodolfo Londero**.
2. Under that publisher, open **Trusted Publishing** and create a policy with:
   - Repository owner: `rodolfoplondero`
   - Repository: `vscode-open-with-external`
   - Workflow: `ci-release.yml`
   - Environment: leave empty; the workflow does not declare an environment.
3. Save the policy before running the publishing job.

The workflow requests a short-lived OpenID Connect token and invokes `vsce publish --oidc` against the already verified VSIX. A Marketplace PAT is not required. Account access and creation of the publisher/policy require the publisher owner's signed-in session.

Official instructions: https://code.visualstudio.com/api/working-with-extensions/publishing-extension#publish-with-github-actions-and-trusted-publishing

## Open VSX

1. Sign in at https://open-vsx.org with your GitHub account.
2. Link your Eclipse account in your Open VSX profile, then review and accept the **Publisher Agreement** yourself.
3. Create a publishing token under **Settings → Access Tokens**.
4. Create namespace **rodolfoplondero** with `npx ovsx create-namespace rodolfoplondero`, authenticated using the `OVSX_PAT` environment variable.
5. Add the token to this repository as an Actions secret named **OVSX_PAT**. Do not put the token in source files, issues, PR descriptions, or chat messages.

Repository secret settings: https://github.com/rodolfoplondero/vscode-open-with-external/settings/secrets/actions

Official instructions: https://github.com/eclipse-openvsx/openvsx/wiki/Publishing-Extensions

Open VSX also supports Trusted Publishing after the first active version is published and namespace ownership is verified. The initial version still requires an access token, so this workflow uses `OVSX_PAT` for the first publication. See https://github.com/eclipse-openvsx/openvsx/wiki/Trusted-Publishing.

## Run publication

- Normal pull requests validate the package and never publish to either store.
- After account setup, run **Test, package and release** manually with **publish_marketplaces** enabled. GitHub requires a manually dispatched workflow to exist on the default branch, so merge the reviewed PR first.
- For subsequent version tags, set the repository Actions variable **PUBLISH_TO_STORES** to `true`. Matching `v<package-version>` tags then publish to both stores after the Windows build succeeds. Leave this variable unset until both accounts are ready.
- Marketplace and Open VSX jobs publish independently. A failure in one does not undo publication in the other. Already-published versions are skipped on reruns.
- Store listing checks and review can delay visibility after a successful upload. Confirm the final public listing before calling a store release complete.

No store credentials are included in this repository. The initial publication is pending until the publisher namespace, Marketplace policy, and Open VSX account/token are configured.
