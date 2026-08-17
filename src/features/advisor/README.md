# Advisor feature

The advisor feature converts an uploaded annual-report PDF into an Osterwalder Business Model Canvas, adds advisor metrics, supports comparisons, and persists reports in Firebase.

## Runtime flow

1. `AdvisorApp.tsx` receives the PDF from the Reports tab.
2. `services/pdf.ts` extracts selectable text inside the browser upload handler.
3. `services/reportPersistence.ts` archives the PDF and extraction in Firebase.
4. `api/advisor.functions.ts` validates the request and creates a compact AI prompt.
5. `api/ai.server.ts` calls GPT-5 mini, records estimated token cost in the server log, and uses Groq only for temporary failures.
6. `AdvisorApp.tsx` displays the returned canvas and stores the evaluation.

## Directory responsibilities

- `components/` contains reusable advisor UI.
- `data/` contains preloaded demonstration reports.
- `api/` contains TanStack server-function RPCs and the server-only OpenAI/Groq client.
- `services/` contains PDF and Firebase integrations.
- `utils/` contains scoring, historical metrics, and Strategy DNA calculations.
- `types.ts` is the single source of advisor data types.

The TanStack route remains at `src/routes/advisor.tsx` because route files must stay inside `src/routes`.
