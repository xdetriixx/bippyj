import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addDoc, collection, getDocs, serverTimestamp } from "firebase/firestore";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/firebase";

export type PortfolioCurrency = "USD" | "SGD";
export type TransactionSide = "buy" | "sell";

export type PortfolioTransaction = {
  id: string;
  ticker: string;
  side: TransactionSide;
  quantity: number;
  executedPrice: number;
  currency: PortfolioCurrency;
  executedAt: Date;
};

export type PortfolioHolding = {
  ticker: string;
  currency: PortfolioCurrency;
  quantity: number;
  costBasis: number;
  averageCost: number;
  realizedGain: number;
};

type NewPortfolioTransaction = Omit<PortfolioTransaction, "id" | "executedAt">;

function parseDate(value: unknown) {
  if (value && typeof value === "object" && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate();
  }
  return new Date(0);
}

function parseTransaction(id: string, value: Record<string, unknown>): PortfolioTransaction | null {
  if (
    typeof value.ticker !== "string" ||
    (value.side !== "buy" && value.side !== "sell") ||
    typeof value.quantity !== "number" ||
    !Number.isFinite(value.quantity) ||
    value.quantity <= 0 ||
    typeof value.executedPrice !== "number" ||
    !Number.isFinite(value.executedPrice) ||
    value.executedPrice <= 0 ||
    (value.currency !== "USD" && value.currency !== "SGD")
  ) {
    return null;
  }
  return {
    id,
    ticker: value.ticker.toUpperCase(),
    side: value.side,
    quantity: value.quantity,
    executedPrice: value.executedPrice,
    currency: value.currency,
    executedAt: parseDate(value.executedAt),
  };
}

async function fetchTransactions(uid: string) {
  if (!db) throw new Error("Firebase is not configured.");
  const snapshot = await getDocs(collection(db, "users", uid, "portfolioTransactions"));
  return snapshot.docs
    .map((item) => parseTransaction(item.id, item.data()))
    .filter((item): item is PortfolioTransaction => item !== null)
    .sort((left, right) => right.executedAt.getTime() - left.executedAt.getTime());
}

async function addTransaction(uid: string, transaction: NewPortfolioTransaction) {
  if (!db) throw new Error("Firebase is not configured.");
  await addDoc(collection(db, "users", uid, "portfolioTransactions"), {
    ticker: transaction.ticker.toUpperCase(),
    side: transaction.side,
    quantity: Number(transaction.quantity.toFixed(8)),
    executedPrice: Number(transaction.executedPrice.toFixed(4)),
    currency: transaction.currency,
    executedAt: serverTimestamp(),
  });
}

export function usePortfolioTransactions() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ["portfolioTransactions", user?.uid ?? "signed-out"], [user?.uid]);
  const result = useQuery({
    queryKey,
    queryFn: () => fetchTransactions(user!.uid),
    enabled: Boolean(user && profile?.role === "investor"),
    staleTime: 60 * 1000,
    retry: 1,
  });

  const recordTransaction = useCallback(
    async (transaction: NewPortfolioTransaction) => {
      if (!user || profile?.role !== "investor") {
        throw new Error("An investor account is required.");
      }
      await addTransaction(user.uid, transaction);
      await queryClient.invalidateQueries({ queryKey });
    },
    [profile?.role, queryClient, queryKey, user],
  );

  return {
    transactions: result.data ?? [],
    holdings: buildPortfolioHoldings(result.data ?? []),
    loading: result.isLoading,
    error: result.error instanceof Error ? result.error.message : null,
    recordTransaction,
  };
}

export function buildPortfolioHoldings(transactions: PortfolioTransaction[]): PortfolioHolding[] {
  const holdings = new Map<string, PortfolioHolding>();
  const chronological = [...transactions].sort(
    (left, right) => left.executedAt.getTime() - right.executedAt.getTime(),
  );

  for (const transaction of chronological) {
    const current = holdings.get(transaction.ticker) ?? {
      ticker: transaction.ticker,
      currency: transaction.currency,
      quantity: 0,
      costBasis: 0,
      averageCost: 0,
      realizedGain: 0,
    };

    if (transaction.side === "buy") {
      current.costBasis += transaction.quantity * transaction.executedPrice;
      current.quantity += transaction.quantity;
      current.averageCost = current.quantity > 0 ? current.costBasis / current.quantity : 0;
      holdings.set(transaction.ticker, current);
      continue;
    }

    const soldQuantity = Math.min(transaction.quantity, current.quantity);
    if (soldQuantity <= 0) continue;
    const removedCost = current.averageCost * soldQuantity;
    current.realizedGain += soldQuantity * transaction.executedPrice - removedCost;
    current.quantity -= soldQuantity;
    current.costBasis = Math.max(0, current.costBasis - removedCost);
    current.averageCost = current.quantity > 0 ? current.costBasis / current.quantity : 0;
    holdings.set(transaction.ticker, current);
  }

  return Array.from(holdings.values())
    .filter((holding) => holding.quantity > 0.00000001)
    .sort((left, right) => left.ticker.localeCompare(right.ticker));
}
