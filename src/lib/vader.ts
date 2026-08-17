// Client-side VADER sentiment (JS port). Runs in the browser during
// the scoring step — no server round-trip needed for the lexicon pass.
// The bundled build exports a CJS module; Vite handles the interop.
import vader from "vader-sentiment";

export type VaderScore = {
  compound: number; // -1..1
  pos: number;
  neg: number;
  neu: number;
};

type VaderAPI = {
  SentimentIntensityAnalyzer: {
    polarity_scores: (text: string) => VaderScore;
  };
};

const analyzer = (vader as unknown as VaderAPI).SentimentIntensityAnalyzer;

export function scoreVader(text: string): VaderScore {
  try {
    const s = analyzer.polarity_scores(text.slice(0, 1000));
    return {
      compound: Number.isFinite(s.compound) ? s.compound : 0,
      pos: s.pos ?? 0,
      neg: s.neg ?? 0,
      neu: s.neu ?? 0,
    };
  } catch {
    return { compound: 0, pos: 0, neg: 0, neu: 1 };
  }
}
