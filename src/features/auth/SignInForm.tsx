"use client";

import {
  useEffect,
  useId,
  useState,
  type FormEvent,
} from "react";
import { LegalInformationNotice } from "@/components/LegalInformationNotice";
import { sendMagicLink } from "./actions";
import { validateSignInEmail } from "./validateSignInEmail";

const RESEND_WAIT_SECONDS = 60;

type SignInFormProps = {
  authError: boolean;
};

export function SignInForm({ authError }: SignInFormProps) {
  const [email, setEmail] = useState("");
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null,
  );
  const [submitMessage, setSubmitMessage] = useState<string | null>(
    authError
      ? "This sign-in link is invalid or has expired. Request a new link."
      : null,
  );
  const [hasSentLink, setHasSentLink] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [secondsUntilResend, setSecondsUntilResend] = useState(0);

  const emailId = useId();
  const guidanceId = useId();
  const errorId = useId();

  useEffect(() => {
    if (secondsUntilResend <= 0) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSecondsUntilResend((currentSeconds) => currentSeconds - 1);
    }, 1000);

    return () => window.clearTimeout(timeoutId);
  }, [secondsUntilResend]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting || secondsUntilResend > 0) {
      return;
    }

    const validation = validateSignInEmail(email);

    if (!validation.ok) {
      setValidationMessage(validation.message);
      return;
    }

    setValidationMessage(null);
    setSubmitMessage(null);
    setIsSubmitting(true);

    const result = await sendMagicLink(validation.email);

    setIsSubmitting(false);

    if (!result.ok) {
      setSubmitMessage(result.message);
      return;
    }

    setHasSentLink(true);
    setSecondsUntilResend(RESEND_WAIT_SECONDS);
  }

  function handleUseDifferentEmail() {
    setHasSentLink(false);
    setEmail("");
    setValidationMessage(null);
    setSubmitMessage(null);
    setSecondsUntilResend(0);
  }

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-4">
        <p className="text-sm font-medium tracking-wide text-teal-800 uppercase">
          Sign in
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-stone-900">
          Sign in with email
        </h1>
        <p className="text-lg leading-8 text-stone-600">
          Enter your email address. Aram will send a sign-in link. Open that
          link in this same browser to continue.
        </p>
      </header>

      <LegalInformationNotice />

      {hasSentLink ? (
        <div className="flex flex-col gap-4">
          <p role="status" className="leading-7 text-stone-700">
            If that address can receive mail, a sign-in link is on the way. Open
            it in this same browser. Do not forward the email, and do not paste
            the link into a case description.
          </p>
          {submitMessage ? (
            <p role="alert" className="text-sm text-red-800">
              {submitMessage}
            </p>
          ) : null}
          <form className="flex flex-col items-start gap-3" onSubmit={handleSubmit}>
            <button
              type="submit"
              disabled={isSubmitting || secondsUntilResend > 0}
              className="inline-flex h-12 items-center justify-center rounded-full bg-teal-800 px-6 text-base font-medium text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:bg-stone-400"
            >
              {secondsUntilResend > 0
                ? `Send another link in ${secondsUntilResend}s`
                : isSubmitting
                  ? "Sending"
                  : "Send another link"}
            </button>
            <button
              type="button"
              onClick={handleUseDifferentEmail}
              className="text-sm font-medium text-teal-800 hover:text-teal-900"
            >
              Use a different email
            </button>
          </form>
        </div>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={handleSubmit}
          noValidate
        >
          <div className="flex flex-col gap-2">
            <label
              htmlFor={emailId}
              className="text-base font-semibold text-stone-900"
            >
              Email address
            </label>
            <input
              id={emailId}
              name="email"
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (validationMessage !== null) {
                  const validation = validateSignInEmail(event.target.value);
                  setValidationMessage(
                    validation.ok ? null : validation.message,
                  );
                }
              }}
              autoComplete="email"
              inputMode="email"
              aria-invalid={validationMessage !== null}
              aria-describedby={
                validationMessage ? `${guidanceId} ${errorId}` : guidanceId
              }
              className="h-12 w-full rounded-xl border border-stone-300 bg-white px-4 text-base text-stone-900 placeholder:text-stone-400 focus:border-teal-800 focus:ring-2 focus:ring-teal-800/20 focus:outline-none"
              placeholder="you@example.com"
            />
            <p id={guidanceId} className="text-sm text-stone-500">
              Use an email you can open on this device.
            </p>
            {validationMessage ? (
              <p id={errorId} role="alert" className="text-sm text-red-800">
                {validationMessage}
              </p>
            ) : null}
            {submitMessage ? (
              <p role="alert" className="text-sm text-red-800">
                {submitMessage}
              </p>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex h-12 items-center justify-center self-start rounded-full bg-teal-800 px-6 text-base font-medium text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:bg-stone-400"
          >
            {isSubmitting ? "Sending" : "Send sign-in link"}
          </button>
        </form>
      )}
    </div>
  );
}
