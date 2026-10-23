import React, { useState } from "react";
import { Logo } from "../components/Logo.jsx";
import { Icon } from "../components/Icon.jsx";

export function AuthPage({
  session,
  creating,
  registration,
  setRegistration,
  loginError,
  setLoginError,
  busy,
  login,
}) {
  const [showPassword, setShowPassword] = useState(false);
  return (
    <main className="auth-scene">
      <section className="auth-brand" aria-label="About TrustChain">
        <div className="auth-brand-top">
          <Logo />
        </div>
        <div className="auth-brand-copy">
          <h1>
            Stay ahead.
            <br />
            Stay <em>assured.</em>
          </h1>
          <p>
            Every deadline remembered.
            <br />
            Every document accounted for.
            <br />
            One less thing on your mind.
          </p>
        </div>
        <div className="auth-art" aria-hidden="true">
          <div className="auth-orbit orbit-one" />
          <div className="auth-orbit orbit-two" />
          <div className="auth-art-cross cross-one">+</div>
          <div className="auth-art-cross cross-two">+</div>
          <div className="auth-document">
            <div className="auth-doc-top">
              <span className="auth-doc-icon">
                <Icon name="file" size={22} />
              </span>
              <span>
                RENEWAL RECORD
                <br />
                <small>Protected with TrustChain</small>
              </span>
              <Icon name="link" size={20} />
            </div>
            <div className="auth-doc-line" />
            <div className="auth-doc-line short" />
            <div className="auth-doc-bottom">
              <span>
                <i /> A clear path forward
              </span>
              <Icon name="shield" size={20} />
            </div>
          </div>
          <div className="auth-floating-shield">
            <img src="/trustchain-logo.png" alt="" />
          </div>
          <div className="auth-art-caption">
            <Icon name="shield" size={15} /> A history you can verify.
          </div>
        </div>
      </section>
      <section className="auth-entry">
        <div className="auth-form-wrap">
          <div className="auth-mobile-logo">
            <Logo />
          </div>
          <h2>
            {creating
              ? "Your organization.\nA fresh start."
              : "Welcome to TrustChain"}
          </h2>
          <p className="auth-intro">
            {creating
              ? "Create a private home for your records, renewals and everything that comes next."
              : "Good to have you back. Sign in to keep your commitments moving forward."}
          </p>
          <form onSubmit={login} className="auth-form">
            {creating && (
              <label htmlFor="auth-organization">
                Organization name
                <div className="auth-input">
                  <Icon name="grid" size={18} />
                  <input
                    id="auth-organization"
                    name="organization"
                    required
                    minLength={2}
                    maxLength={120}
                    autoComplete="organization"
                    placeholder="Your organization"
                    disabled={busy}
                  />
                </div>
              </label>
            )}
            <label htmlFor="auth-email">
              Email address
              <div className="auth-input">
                <span className="auth-at">@</span>
                <input
                  id="auth-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="username"
                  placeholder="you@organization.com"
                  disabled={busy}
                />
              </div>
            </label>
            <label htmlFor="auth-password">
              <span className="auth-label-row">
                Password{creating && <small>At least 12 characters</small>}
              </span>
              <div className="auth-input">
                <Icon name="shield" size={18} />
                <input
                  id="auth-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={creating ? 12 : undefined}
                  maxLength={256}
                  autoComplete={creating ? "new-password" : "current-password"}
                  placeholder={
                    creating
                      ? "Create a strong password"
                      : "Enter your password"
                  }
                  disabled={busy}
                />
                <button
                  type="button"
                  className="auth-reveal"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </label>
            {loginError && (
              <div role="alert" className="auth-error">
                <Icon name="info" size={18} />
                {loginError}
              </div>
            )}
            <button disabled={busy || !session} className="auth-submit">
              {busy
                ? "Opening your workspace…"
                : creating
                  ? "Create my workspace"
                  : "Sign in to workspace"}
              <Icon name="arrow" size={20} />
            </button>
          </form>
          {session?.organizationRegistrationEnabled &&
            !session?.setupRequired && (
              <div className="auth-switch">
                <span>
                  {registration
                    ? "Already part of TrustChain?"
                    : "New to TrustChain?"}
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setRegistration(!registration);
                    setLoginError("");
                    setShowPassword(false);
                  }}
                >
                  {registration ? "Sign in" : "Create an organization"}
                  <span aria-hidden="true"> ↗</span>
                </button>
              </div>
            )}
        </div>
      </section>
    </main>
  );
}
