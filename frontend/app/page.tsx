
"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import axios from "axios";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import api from "./api";

type Transaction = {
  id: string;
  text: string;
  amount: string;
  created_at: string;
};

type RequestStatus = "idle" | "loading" | "success" | "error";
type TransactionType = "income" | "expense";
type AuthStatus = "checking" | "authenticated" | "anonymous";
type AuthMode = "login" | "register";
type ApiErrorResponse = {
  detail?: string;
  text?: string[];
  amount?: string[];
  email?: string[];
  password?: string[];
  password_confirm?: string[];
};

const formatGNF = (amount: number) => `${amount.toFixed(2)} GNF`;
const formatGroupedAmount = (digits: string) =>
  digits.replace(/\B(?=(\d{3})+(?!\d))/g, "\u202F");
const MAX_TRANSACTION_AMOUNT = 99_999_999;
const NOTIFICATION_ID = "app-notification";

const notifySuccess = (message: string) =>
  toast.success(message, { id: NOTIFICATION_ID });
const notifyError = (message: string) =>
  toast.error(message, { id: NOTIFICATION_ID });

export default function Home() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>("checking");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [userEmail, setUserEmail] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authPasswordConfirm, setAuthPasswordConfirm] = useState("");
  const [showAuthPassword, setShowAuthPassword] = useState(false);
  const [showAuthPasswordConfirm, setShowAuthPasswordConfirm] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [status, setStatus] = useState<RequestStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const amountInputRef = useRef<HTMLInputElement>(null);
  const [transactionType, setTransactionType] = useState<TransactionType>("expense");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingTransactionId, setDeletingTransactionId] = useState<string | null>(null);
  const addTransactionDialogRef = useRef<HTMLDialogElement>(null);
  const amounts = transactions.map((transaction) => Number(transaction.amount) || 0);
  const total = amounts.reduce((sum, amount) => sum + amount, 0);
  const balance = total;
  const income =
    amounts.filter((amount) => amount > 0).reduce((acc, item) => acc + item, 0) || 0;  
  const expenses =
    amounts
      .filter((amount) => amount < 0)
      .reduce((acc, item) => acc + Math.abs(item), 0) || 0;
  const ratio = income > 0 ? Math.min((expenses / income) * 100, 100) : 0;

  const formaDate = (datestring: string) => {
    const date = new Date(datestring);
    return date.toLocaleDateString("fr-FR", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit", 
    });
  };

  async function addTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedAmount = Number(amountInput);

    if (
      !description.trim() ||
      !Number.isSafeInteger(parsedAmount) ||
      parsedAmount < 1 ||
      parsedAmount > MAX_TRANSACTION_AMOUNT
    ) {
      notifyError(
        `Saisis un montant entier entre 1 et ${formatGroupedAmount(
          String(MAX_TRANSACTION_AMOUNT)
        )} GNF.`
      );
      return;
    }

    const signedAmount =
      transactionType === "expense" ? -parsedAmount : parsedAmount;

    setIsSubmitting(true);

    try {
      const { data } = await api.post<Transaction>("transactions/", {
        text: description.trim(),
        amount: signedAmount.toFixed(2),
      });
      setTransactions((currentTransactions) => [data, ...currentTransactions]);
      setStatus("success");
      setDescription("");
      setAmountInput("");
      notifySuccess("Transaction ajoutée avec succès.");
      addTransactionDialogRef.current?.close();
    } catch (error) {
      console.error("Erreur ajout transaction", error);
      const responseData = axios.isAxiosError<ApiErrorResponse>(error)
        ? error.response?.data
        : undefined;
      const message =
        responseData?.detail ??
        responseData?.text?.[0] ??
        responseData?.amount?.[0] ??
        (error instanceof Error
          ? error.message
          : "Une erreur inconnue est survenue.");
      notifyError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const loadTransactions = useCallback(async (showSuccessToast = true) => {
    setStatus("loading");
    setErrorMessage(null);

    try {
      const { data } = await api.get<Transaction[]>("transactions/");
      setTransactions(data);
      setStatus("success");
      if (showSuccessToast) {
        notifySuccess("Transactions chargées avec succès.");
      }
    } catch (error) {
      console.error("Erreur chargement transactions" , error);
      const message =
        error instanceof Error ? error.message : "Une erreur inconnue est survenue."
      setErrorMessage(message);
      setStatus("error");
      notifyError(message);
    }
  }, []);

  const checkCurrentUser = useCallback(async () => {
    try {
      await api.get("auth/csrf/");
      const { data } = await api.get<{ email: string }>("auth/me/");
      setUserEmail(data.email);
      setAuthStatus("authenticated");

      const shouldReloadTransactions =
        window.sessionStorage.getItem("reloadTransactionsAfterDelete") === "true";
      if (shouldReloadTransactions) {
        window.sessionStorage.removeItem("reloadTransactionsAfterDelete");
      }
      await loadTransactions(shouldReloadTransactions);
    } catch (error) {
      const responseStatus = axios.isAxiosError(error)
        ? error.response?.status
        : undefined;
      if (responseStatus === 401 || responseStatus === 403) {
        setAuthStatus("anonymous");
        return;
      }

      console.error("Erreur vérification de session", error);
      setAuthError("Impossible de joindre le serveur. Vérifie que le backend est démarré.");
      setAuthStatus("anonymous");
    }
  }, [loadTransactions]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void checkCurrentUser();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [checkCurrentUser]);

  async function submitAuthentication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsAuthenticating(true);
    setAuthError(null);

    try {
      await api.get("auth/csrf/");
      const endpoint = authMode === "register" ? "auth/register/" : "auth/login/";
      const payload =
        authMode === "register"
          ? {
              email: authEmail,
              password: authPassword,
              password_confirm: authPasswordConfirm,
            }
          : { email: authEmail, password: authPassword };
      const { data } = await api.post<{ email: string }>(endpoint, payload);
      setUserEmail(data.email);
      setAuthStatus("authenticated");
      setAuthPassword("");
      setAuthPasswordConfirm("");
      notifySuccess(
        authMode === "register" ? "Compte créé avec succès." : "Connexion réussie."
      );
      await loadTransactions(false);
    } catch (error) {
      console.error("Erreur authentification", error);
      const responseData = axios.isAxiosError<ApiErrorResponse>(error)
        ? error.response?.data
        : undefined;
      const message =
        responseData?.detail ??
        responseData?.email?.[0] ??
        responseData?.password?.[0] ??
        responseData?.password_confirm?.[0] ??
        (error instanceof Error
          ? error.message
          : "Une erreur inconnue est survenue.");
      setAuthError(message);
    } finally {
      setIsAuthenticating(false);
    }
  }

  async function logoutUser() {
    try {
      await api.get("auth/csrf/");
      await api.post("auth/logout/");
      setUserEmail("");
      setTransactions([]);
      setStatus("idle");
      setAuthStatus("anonymous");
      notifySuccess("Déconnexion réussie.");
    } catch (error) {
      console.error("Erreur déconnexion", error);
      notifyError("Impossible de se déconnecter. Réessaie.");
    }
  }

  async function deleteTransaction(transaction: Transaction) {
    const confirmed = window.confirm(
      `Supprimer la transaction « ${transaction.text} » ?`
    );
    if (!confirmed) {
      return;
    }

    setDeletingTransactionId(transaction.id);

    try {
      await api.delete(`transactions/${transaction.id}/`);
      setTransactions((currentTransactions) =>
        currentTransactions.filter((current) => current.id !== transaction.id)
      );
      notifySuccess("Transaction supprimée avec succès.");
      window.sessionStorage.setItem("reloadTransactionsAfterDelete", "true");
      window.setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      console.error("Erreur suppression transaction", error);
      const responseData = axios.isAxiosError<ApiErrorResponse>(error)
        ? error.response?.data
        : undefined;
      const message =
        responseData?.detail ??
        (error instanceof Error
          ? error.message
          : "Une erreur inconnue est survenue.");
      notifyError(message);
    } finally {
      setDeletingTransactionId(null);
    }
  }

  if (authStatus === "checking") {
    return (
      <main className="grid min-h-screen place-items-center bg-base-100 text-base-content">
        <span aria-label="Vérification de la session" className="loading loading-spinner loading-lg" />
      </main>
    );
  }

  if (authStatus === "anonymous") {
    return (
      <main className="grid min-h-screen place-items-center bg-base-100 px-5 py-10 text-base-content">
        <section className="w-full max-w-md rounded-2xl border border-base-300 bg-base-200 p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-3 font-semibold tracking-wide">
            <span className="grid size-10 place-items-center rounded-full bg-warning/15 text-warning">
              <Wallet aria-hidden="true" size={20} />
            </span>
            <span>Dépensio</span>
          </div>
          <h1 className="text-2xl font-semibold">
            {authMode === "register" ? "Créer un compte" : "Connexion"}
          </h1>
          <p className="mt-2 text-sm text-base-content/65">
            {authMode === "register"
              ? "Crée ton compte pour gérer tes transactions en privé."
              : "Connecte-toi pour retrouver tes transactions."}
          </p>

          <form className="mt-6 grid gap-4" onSubmit={submitAuthentication}>
            <label className="form-control w-full">
              <span className="label-text mb-2">Adresse e-mail</span>
              <input
                autoComplete="email"
                className="input input-bordered w-full"
                onChange={(event) => setAuthEmail(event.target.value)}
                required
                type="email"
                value={authEmail}
              />
            </label>
            <label className="form-control w-full">
              <span className="label-text mb-2">Mot de passe</span>
              <span className="relative">
                <input
                  autoComplete={
                    authMode === "register" ? "new-password" : "current-password"
                  }
                  className="input input-bordered w-full pr-12"
                  onChange={(event) => setAuthPassword(event.target.value)}
                  required
                  type={showAuthPassword ? "text" : "password"}
                  value={authPassword}
                />
                <button
                  aria-label={
                    showAuthPassword
                      ? "Masquer le mot de passe"
                      : "Afficher le mot de passe"
                  }
                  aria-pressed={showAuthPassword}
                  className="btn btn-ghost btn-sm absolute right-1 top-1/2 -translate-y-1/2"
                  onClick={() => setShowAuthPassword((visible) => !visible)}
                  type="button"
                >
                  {showAuthPassword ? (
                    <EyeOff aria-hidden="true" className="size-5" />
                  ) : (
                    <Eye aria-hidden="true" className="size-5" />
                  )}
                </button>
              </span>
            </label>
            {authMode === "register" && (
              <label className="form-control w-full">
                <span className="label-text mb-2">Confirmer le mot de passe</span>
                <span className="relative">
                  <input
                    autoComplete="new-password"
                    className="input input-bordered w-full pr-12"
                    onChange={(event) => setAuthPasswordConfirm(event.target.value)}
                    required
                    type={showAuthPasswordConfirm ? "text" : "password"}
                    value={authPasswordConfirm}
                  />
                  <button
                    aria-label={
                      showAuthPasswordConfirm
                        ? "Masquer la confirmation du mot de passe"
                        : "Afficher la confirmation du mot de passe"
                    }
                    aria-pressed={showAuthPasswordConfirm}
                    className="btn btn-ghost btn-sm absolute right-1 top-1/2 -translate-y-1/2"
                    onClick={() =>
                      setShowAuthPasswordConfirm((visible) => !visible)
                    }
                    type="button"
                  >
                    {showAuthPasswordConfirm ? (
                      <EyeOff aria-hidden="true" className="size-5" />
                    ) : (
                      <Eye aria-hidden="true" className="size-5" />
                    )}
                  </button>
                </span>
              </label>
            )}

            {authError && (
              <p className="alert alert-error text-sm" role="alert">
                {authError}
              </p>
            )}

            <button
              className="btn btn-warning mt-1"
              disabled={isAuthenticating}
              type="submit"
            >
              {isAuthenticating
                ? "..."
                : authMode === "register"
                  ? "Créer mon compte"
                  : "Se connecter"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-base-content/65">
            {authMode === "register" ? "Tu as déjà un compte ?" : "Pas encore de compte ?"}{" "}
            <button
              className="link link-warning"
              onClick={() => {
                setAuthError(null);
                setShowAuthPassword(false);
                setShowAuthPasswordConfirm(false);
                setAuthMode(authMode === "register" ? "login" : "register");
              }}
              type="button"
            >
              {authMode === "register" ? "Se connecter" : "Créer un compte"}
            </button>
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-base-100 text-base-content">
      <header className="border-b border-warning/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link className="flex items-center gap-3 font-semibold tracking-wide" href="/">
            <span className="grid size-9 place-items-center rounded-full bg-warning/15 text-warning">
              <Wallet aria-hidden="true" size={18} />
            </span>
            <span>Dépensio</span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <span className="block text-sm text-base-content/60">
                Gestion des finances
              </span>
              <span className="block text-xs text-base-content/45">{userEmail}</span>
            </div>
            <button
              aria-label="Actualiser les transactions"
              className="btn btn-circle btn-ghost btn-sm"
              disabled={status === "loading"}
              onClick={() => void loadTransactions()}
              type="button"
            >
              <svg
                aria-hidden="true"
                className={`size-5 ${status === "loading" ? "animate-spin" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  d="M20 7v5h-5M4 17v-5h5m10-1a7 7 0 0 0-12.1-4.9L4 8m16 8-2.9 2.9A7 7 0 0 1 5 13"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                />
              </svg>
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => void logoutUser()}
              type="button"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      <div className="border-b border-warning/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <h1 className="text-2xl font-semibold">Vue d’ensemble</h1>
          <span className="text-sm font-medium text-warning">Montants en GNF</span>
        </div>
      </div>

      <section className="mx-auto flex w-full max-w-4xl flex-col gap-7 px-5 py-8">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Votre solde", amount: total },
            { label: "Dépenses", amount: expenses },
            { label: "Revenus", amount: income },
          ].map((item) => (
            <article
              className="rounded-2xl border border-base-300 bg-base-200 p-5 shadow-sm"
              key={item.label}
            >
              <div
                className={`badge mb-5 size-9 rounded-full p-0 ${
                  item.label === "Revenus"
                    ? "badge-success"
                    : item.label === "Dépenses"
                      ? "badge-error"
                      : "bg-warning/15 text-warning"
                }`}
              >
                {item.label === "Votre solde" ? (
                  <Wallet aria-hidden="true" size={18} />
                ) : item.label === "Revenus" ? (
                  <ArrowUp aria-hidden="true" size={18} />
                ) : (
                  <ArrowDown aria-hidden="true" size={18} />
                )}
              </div>
              <p className="text-sm text-base-content/65">{item.label}</p>
              {item.label === "Votre solde" ? (
                <div className="start-value mt-1 text-xl font-semibold text-warning">
                  {formatGNF(balance)}
                </div>
              ) : (
                <p className="mt-1 text-xl font-semibold text-warning">
                  {formatGNF(item.amount)}
                </p>
              )}
            </article>
          ))}
        </div>

        <section aria-labelledby="ratio-heading" className="space-y-3">
          <div className="flex items-end justify-between gap-4">
            <h2
              className="flex items-center gap-2 text-sm font-medium text-base-content/75"
              id="ratio-heading"
            >
              <Activity aria-hidden="true" className="h-4 w-4 text-warning" />
              Dépenses par rapport aux revenus
            </h2>
            <span className="font-semibold text-warning">{ratio.toFixed(0)}%</span>
          </div>
          <progress
            aria-label="Ratio des dépenses par rapport aux revenus"
            className="progress progress-warning h-3 w-full"
            max={100}
            value={ratio}
          />
        </section>

        <section aria-labelledby="add-transaction-heading" className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-medium" id="add-transaction-heading">
                Ajouter une transaction
              </h2>
              <p className="text-sm text-base-content/60">
                Enregistre un revenu ou une dépense en GNF.
              </p>
            </div>
            <button
              aria-haspopup="dialog"
              className="btn btn-warning shrink-0"
              onClick={() => addTransactionDialogRef.current?.showModal()}
              type="button"
            >
              Ajouter
            </button>
          </div>

          <dialog
            aria-labelledby="add-transaction-dialog-title"
            className="modal"
            ref={addTransactionDialogRef}
          >
            <div className="modal-box">
              <form method="dialog">
                <button
                  aria-label="Fermer le dialogue"
                  className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
                  type="submit"
                >
                  ✕
                </button>
              </form>
              <h3 className="text-lg font-bold" id="add-transaction-dialog-title">
                Ajouter une transaction
              </h3>
              <p className="py-2 text-sm text-base-content/60">
                Enregistre un revenu ou une dépense en GNF.
              </p>

              <form className="mt-4 grid gap-3" onSubmit={addTransaction}>
                <input
                  aria-label="Description"
                  autoComplete="off"
                  className="input input-bordered w-full"
                  maxLength={255}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Ex. Courses, salaire..."
                  required
                  spellCheck={true}
                  value={description}
                />
                <select
                  aria-label="Type de transaction"
                  className="select select-bordered w-full"
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === "income" || value === "expense") {
                      setTransactionType(value);
                    }
                  }}
                  value={transactionType}
                >
                  <option value="income">Revenu</option>
                  <option value="expense">Dépense</option>
                </select>
                <input
                  aria-label="Montant en GNF"
                  className="input input-bordered w-full"
                  inputMode="numeric"
                  onChange={(event) => {
                    const input = event.currentTarget;
                    const compactValue = input.value.replace(/[\s\u00A0\u202F]/g, "");
                    if (!/^\d*$/.test(compactValue)) {
                      setAmountInput(compactValue);
                      return;
                    }

                    const cursor = input.selectionStart ?? input.value.length;
                    const digitsBeforeCursor = input.value
                      .slice(0, cursor)
                      .replace(/\D/g, "").length;
                    setAmountInput(compactValue);
                    window.requestAnimationFrame(() => {
                      const formatted = formatGroupedAmount(compactValue);
                      let nextCursor = 0;
                      let digitsFound = 0;
                      while (
                        nextCursor < formatted.length &&
                        digitsFound < digitsBeforeCursor
                      ) {
                        if (/\d/.test(formatted[nextCursor])) {
                          digitsFound += 1;
                        }
                        nextCursor += 1;
                      }
                      amountInputRef.current?.setSelectionRange(
                        nextCursor,
                        nextCursor
                      );
                    });
                  }}
                  placeholder="Montant (GNF)"
                  required
                  ref={amountInputRef}
                  type="text"
                  value={
                    /^\d*$/.test(amountInput)
                      ? formatGroupedAmount(amountInput)
                      : amountInput
                  }
                />
                <button
                  className="btn btn-warning mt-2"
                  disabled={isSubmitting}
                  type="submit"
                >
                  {isSubmitting ? "..." : "Ajouter"}
                </button>
              </form>
            </div>
            <form className="modal-backdrop" method="dialog">
              <button aria-label="Fermer le dialogue" type="submit">
                Fermer
              </button>
            </form>
          </dialog>
        </section>

        <section aria-labelledby="transactions-heading" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium" id="transactions-heading">
              Transactions
            </h2>
            <span className="text-sm text-base-content/60">
              {transactions.length} {transactions.length === 1 ? "opération" : "opérations"}
            </span>
          </div>

          {status === "error" && (
            <p className="alert alert-error" role="alert">
              Impossible de charger les transactions : {errorMessage}
            </p>
          )}

          {status === "success" && transactions.length === 0 && (
            <p className="rounded-2xl border border-base-300 bg-base-200 p-5 text-center text-base-content/65">
              Aucune transaction pour le moment. Ajoute-en une avec le formulaire ci-dessus.
            </p>
          )}

          {status === "idle" && (
            <p className="rounded-2xl border border-base-300 bg-base-200 p-5 text-center text-base-content/65">
              Clique sur actualiser pour charger tes transactions.
            </p>
          )}

          {transactions.length > 0 && (
            <div className="overflow-x-auto rounded-box border border-base-content/5 bg-base-100">
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Description</th>
                    <th>Montant</th>
                    <th>Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction, index) => {
                    const transactionAmount = Number(transaction.amount) || 0;
                    const isIncome = transactionAmount > 0;
                    const isDeletingTransaction =
                      deletingTransactionId === transaction.id;

                    return (
                      <tr key={transaction.id}>
                        <th scope="row">{index + 1}</th>
                        <td>{transaction.text}</td>
                        <td
                          className={
                            isIncome ? "font-semibold text-success" : "font-semibold text-error"
                          }
                        >
                          <span className="inline-flex items-center gap-2">
                            {isIncome ? (
                              <TrendingUp aria-hidden="true" className="size-4" />
                            ) : (
                              <TrendingDown aria-hidden="true" className="size-4" />
                            )}
                            <span>
                              {isIncome ? "+" : "−"}
                              {formatGNF(Math.abs(transactionAmount))}
                            </span>
                          </span>
                        </td>
                        <td>
                          <time dateTime={transaction.created_at}>
                            {formaDate(transaction.created_at)}
                          </time>
                        </td>
                        <td>
                          <button
                            aria-label={`Supprimer la transaction ${transaction.text}`}
                            aria-busy={isDeletingTransaction}
                            className={`btn btn-sm group w-28 justify-start gap-2 transition-colors duration-200 ${
                              isDeletingTransaction
                                ? "btn-error"
                                : "btn-ghost text-error hover:bg-error hover:text-error-content"
                            }`}
                            disabled={deletingTransactionId !== null}
                            onClick={() => deleteTransaction(transaction)}
                            type="button"
                          >
                            <Trash2 aria-hidden="true" className="size-4" />
                            <span
                              className={`whitespace-nowrap transition-opacity duration-200 ${
                                isDeletingTransaction
                                  ? "opacity-100"
                                  : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
                              }`}
                            >
                              Supprimer
                            </span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}