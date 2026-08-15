# Minimal Firebase setup

1. Copy `.env.example` to `.env.local` and insert the Firebase Web App values from **Firebase Console > Project settings > General > Your apps**.
2. In **Authentication > Sign-in method**, enable **Email/Password**. Anonymous sign-in is no longer used.
3. Create the Cloud Firestore database and Firebase Storage bucket.
4. Deploy `firestore.rules` and `storage.rules`:

```sh
firebase login
firebase use --add
firebase deploy --only firestore:rules,storage
```

Firebase stores authentication, one authorization field, investor-created records, and advisor
reports that users explicitly upload:

```text
Firebase Authentication: UID, email, password, display name
Firestore: users/{userId} (investor/advisor role only)
Firestore: users/{userId}/investmentWorkspaces/{ticker} (private investor decision inputs and review baseline)
Firestore: users/{userId}/portfolioTransactions/{transactionId} (private simulated buy/sell records)
Storage:  reports/{userId}/{reportId}/{originalFile}
Firestore: reports/{reportId} (metadata, latest result, and optional comparison)
Firestore: reports/{reportId}/evaluations/{evaluationId} (shared advisor evaluation records)
Firestore: reports/{reportId}/comparisons/{comparisonId} (shared advisor comparison records)
```

The fixed prototype stock and illustrative ESG catalogue ships with the application, so it appears
immediately and cannot be changed by an investor or advisor. The configured market-data provider
adds end-of-day market prices when a user opens a stock.

- Preferences, recent views, comparison choices, and dismissals remain in browser local storage.
- Investor AI output, chat messages, and feedback are not persisted.
- Investment workspaces store only the investor's decision, thesis, horizon, risk limit, checklist,
  and one compact last-reviewed snapshot. Materiality maps, alert messages, peer calculations, and
  readiness scores are derived in the app and are not duplicated in Firestore.
- Simulated portfolios store append-only buy/sell transactions only. Holdings, cost basis, current
  value, gains, performance rankings, concentration alerts, and ESG summaries are calculated in the
  app from transactions, the application catalogue, and the configured market-price provider.
- Extracted PDF text is not duplicated in Firestore or Storage. It is regenerated from the saved PDF
  only when an unfinished report is reopened.
- Only the latest report evaluation and comparison are kept in the report document.
- Signed-in users can read shared report results, while only the owner can create or update them.
  The original PDF in Storage remains private to its owner. The group rules intentionally allow any
  signed-in user to delete a shared report or its evaluation/comparison records.

The Firebase Web API key identifies the project and is safe in the frontend configuration. Never put a service-account private key in this app. Keep `.env.local` out of Git.
