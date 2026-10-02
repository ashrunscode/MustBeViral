import type { LegalPageCopy } from './legal-copy';
import { PublicFooter } from './public-footer';
import { PublicHeader } from './public-header';

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/gu, '-');
}

/** One legal page: the title, the one-sentence intro, the date it describes, and its sections. */
export function LegalPage({ copy }: Readonly<{ copy: LegalPageCopy }>) {
  return (
    <div className="pub-page pub-page--legal" lang="en">
      <a className="skip-link" href="#legal-heading">
        Skip to main content
      </a>
      <div className="pub-shell">
        <PublicHeader homeHref="/" links={[]} />
        <main className="legal-page" id="legal-main">
          <header className="pub-hero">
            <h1 id="legal-heading">{copy.title}</h1>
            <p>{copy.intro}</p>
            <p className="legal-updated">Last changed {copy.updated}.</p>
          </header>
          {copy.sections.map((section) => {
            const id = `legal-${slug(section.heading)}`;
            return (
              <section aria-labelledby={id} key={section.heading}>
                <h2 id={id}>{section.heading}</h2>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                {section.items === undefined ? null : (
                  <ul>
                    {section.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </main>
      </div>
      <PublicFooter surface="legal" />
    </div>
  );
}
