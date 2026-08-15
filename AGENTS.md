# AGENTS.md

## Project overview
- This repo is a TanStack Start + React + TypeScript application.
- Main app entry points are under src/ and route files live in src/routes/.
- Follow the existing project structure instead of introducing Next.js or Remix conventions.

## Working conventions
- Run the relevant checks before finishing changes:
  - `npm run lint`
  - `npm run build`
- Prefer small, focused changes that match the surrounding code style.
- Keep UI components consistent with the existing shadcn-style primitives in src/components/ui/.

## Routing and file structure
- TanStack Start uses file-based routing. New routes belong in src/routes/.
- Do not create Next.js/Remix-style folders such as src/pages/ or app/layout.tsx.
- The root layout is src/routes/__root.tsx; preserve its existing Outlet usage.
- Do not edit src/routeTree.gen.ts by hand; it is generated.
- See src/routes/README.md for route naming conventions.

## Environment and config guidance
- Use server-only modules with the `.server.ts` suffix for secrets or server-only configuration.
- Read environment variables inside functions/handlers rather than at module scope, especially for Cloudflare-style server environments.
- Public client-safe config should use VITE_ prefixed values in import.meta.env.
- Keep Firebase-related code in src/lib/firebase.ts and server-only config in src/lib/config.server.ts.

## Important implementation notes
- The app uses Firebase optionally; some features may work with missing config values.
- Error handling is centralized in src/lib/error-capture.ts and src/lib/error-page.ts.
- Use the @/ path alias for imports from src/.
