import { MonoCaps } from '@mustbeviral/ui';

export function LandingPage() {
  return (
    <main className="landing-page">
      <a className="skip-link" href="#landing-heading">
        Skip to main content
      </a>
      <section aria-labelledby="landing-heading" className="landing-shell">
        <header className="landing-header">
          <MonoCaps>MustBeViral Studio</MonoCaps>
          <div className="landing-header__actions">
            <a className="auth-link" href="/signup">
              Request access
            </a>
            <a className="auth-primary auth-primary--link" href="/login">
              Sign in
            </a>
          </div>
        </header>

        <div className="landing-hero">
          <MonoCaps className="landing-eyebrow">Meta Campaign Launch Pack</MonoCaps>
          <h1 id="landing-heading">
            From a validated brief to reviewable ads in one transparent workflow
          </h1>
          <p className="landing-lede">
            MustBeViral Studio turns approved product truth, brand constraints, and offer metadata
            into three composed Meta ad concepts — stills, adaptations, copy, and motion — with a
            named price before any provider spend begins.
          </p>
          <ul className="landing-proof">
            <li>
              <strong>Plan before spend.</strong> Inspect the launch-pack graph, read the maximum
              charge, and confirm explicitly.
            </li>
            <li>
              <strong>Review composed ads.</strong> Judge Feed, Stories, and Reels placements as
              buyers see them, not as unnamed files.
            </li>
            <li>
              <strong>Export with proof.</strong> Download a private ZIP with deterministic names,
              QA, and an immutable receipt.
            </li>
          </ul>
          <div className="landing-cta">
            <a className="auth-primary auth-primary--link" href="/login?next=%2Fstudio">
              Sign in to Studio
            </a>
            <a className="auth-secondary landing-cta__secondary" href="/signup">
              Request access
            </a>
          </div>
          <p className="landing-pilot">
            <MonoCaps>Pilot · $500 setup · $149/mo · usage wallet</MonoCaps>
            Enrollment is invitation-only while the launch pack is in closed evaluation.
          </p>
        </div>

        <footer className="landing-footer">
          <a className="auth-link" href="/login">
            Sign in
          </a>
          <span aria-hidden="true">·</span>
          <a className="auth-link" href="/signup">
            Request access
          </a>
        </footer>
      </section>
    </main>
  );
}
