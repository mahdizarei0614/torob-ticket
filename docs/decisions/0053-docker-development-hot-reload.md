# 0053 — Docker development with automatic source updates

Accepted and implemented2026-10-30. Owner requested Docker-hosted hot reload for
consumer, admin and API. Source commit: `365cef1`. Specification1.25.

Use `pnpm docker:dev` with an explicit development Compose override, retaining
`pnpm docker:up` for packaged review. The same loopback gateway serves both Vite
apps, API and independent root/admin HMR WebSockets. Alternate host ports work.
Source is mounted read-only; dependencies, compiler/Vite output and generated
Prisma remain in Linux storage. Only a missing empty ignored generated-client
mountpoint is prepared on the host, with real-path and symlink checks.

The API uses the real TypeScript dependency watcher, complete successful emit,
alias rewriting and serialized child-server replacement. Type errors retain the
last working server. Parent-directory notifications cover atomic replacement
saves; an explicit polling flag handles unreliable mount notifications. Shared
frontend library directories are watched too. Dependency/schema/runtime-tool
changes require rerunning startup; migration creation remains explicit.

Development refresh preserves the consumer's current comparison and admin
context identity. Same-location effect replay no longer masquerades as a new
navigation; real URL/pop/generation authority still applies. The admin context
has a stable React-only leaf boundary through dependency refresh cascades.

Both modes retain the selected project's database. Packaged startup removes
only exact project/service/development-labelled frontend containers after the
replacement is healthy. Normal shutdown preserves volumes. Explicit reset has
its existing destructive project-database meaning plus strictly owned generated
cache cleanup; no global prune or broad orphan removal is introduced.

Actual source edits, shared libraries, error recovery, stable container/image
identities and zero browser errors passed through a custom4350 gateway. The
original4300 database/container and exact48-quote snapshot survived switching to
development mode. A separate4350 reverse-mode rehearsal retained its database,
served packaged pages, and was then removed after ownership checks. The normal
4300 stack remains in development mode. See the [checkpoint](../evidence/adjustments/docker-hot-reload/checkpoint.md)
and [independent review](../evidence/adjustments/docker-hot-reload/review-independent.md).

This closes the owner's development-runtime adjustment. It does not close the
remaining M7 acceptance matrix or assert interruption-free in-flight API work.
