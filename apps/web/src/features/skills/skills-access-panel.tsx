'use client';

import { Button, Dialog, LedgerTable, MonoCaps } from '@mustbeviral/ui';
import { useEffect, useState } from 'react';

import {
  createP1bManagementClient,
  type SkillListItem,
  type SkillVersionDetail,
} from '../../lib/core/p1b-client';

function formatTimestamp(value: string): string {
  return value.replace('T', ' ').replace(/\.\d+Z$/u, ' UTC');
}

function versionLabel(version: Readonly<{ version_number: number; title: string }>): string {
  return `v${version.version_number} · ${version.title}`;
}

export function SkillsAccessPanel({ workspaceId }: Readonly<{ workspaceId: string }>) {
  const [skills, setSkills] = useState<readonly SkillListItem[]>([]);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [versions, setVersions] = useState<readonly SkillVersionDetail[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [name, setName] = useState('launch-copy');
  const [title, setTitle] = useState('Launch copy');
  const [instructions, setInstructions] = useState(
    'Write concise, benefit-led launch copy for a DTC product drop.',
  );
  const [busy, setBusy] = useState(false);
  const [publishedVersion, setPublishedVersion] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadSkills() {
      setError(null);
      try {
        const client = await createP1bManagementClient();
        const listed = await client.listSkills(workspaceId);
        if (!cancelled) setSkills(listed);
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error ? cause.message : 'Skills are unavailable in this environment.',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadSkills();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  async function reloadSkills(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const client = await createP1bManagementClient();
      const listed = await client.listSkills(workspaceId);
      setSkills(listed);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Skills are unavailable in this environment.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadVersionHistory(skillId: string): Promise<void> {
    setSelectedSkillId(skillId);
    setVersionsLoading(true);
    setError(null);
    try {
      const client = await createP1bManagementClient();
      const listed = await client.listSkillVersions(workspaceId, skillId);
      setVersions(listed.versions);
      setSelectedVersionId(listed.versions[0]?.skill_version_id ?? null);
    } catch (cause) {
      setVersions([]);
      setSelectedVersionId(null);
      setError(
        cause instanceof Error
          ? cause.message
          : 'Version history is unavailable in this environment.',
      );
    } finally {
      setVersionsLoading(false);
    }
  }

  async function handlePublish() {
    setBusy(true);
    setError(null);
    try {
      const client = await createP1bManagementClient();
      const published = await client.publishSkill(workspaceId, { name, title, instructions });
      setPublishedVersion(published.version_number);
      setPublishOpen(false);
      await reloadSkills();
      await loadVersionHistory(published.skill_id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The Skill could not be published.');
    } finally {
      setBusy(false);
    }
  }

  const selectedVersion =
    versions.find((version) => version.skill_version_id === selectedVersionId) ?? null;
  const selectedSkill = skills.find((skill) => skill.id === selectedSkillId) ?? null;

  return (
    <main className="access-panel skills-panel" id="main-content">
      <section className="access-panel__card" aria-labelledby="skills-heading">
        <MonoCaps>User-authored Skills</MonoCaps>
        <h1 id="skills-heading">Skills and version history</h1>
        <p>
          Publish reusable workflow instructions for your team. Each publish creates an immutable
          version; edits always create a new version and never mutate a published snapshot. Skills
          cannot access database, storage, or billing credentials.
        </p>
        <div className="access-panel__actions">
          <Button type="button" onClick={() => setPublishOpen(true)} disabled={busy}>
            Publish Skill
          </Button>
        </div>
        {error === null ? null : (
          <p className="access-panel__error" role="alert">
            {error}
          </p>
        )}
      </section>

      <div className="skills-panel__grid">
        <section className="access-panel__card" aria-labelledby="skills-list-heading">
          <MonoCaps>Workspace Skills</MonoCaps>
          <h2 id="skills-list-heading">Published Skills</h2>
          {loading ? <p role="status">Loading skills…</p> : null}
          {!loading && skills.length === 0 ? (
            <p>No Skills yet. Publish your first reusable workflow instruction.</p>
          ) : null}
          {!loading && skills.length > 0 ? (
            <LedgerTable>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Latest version</th>
                  <th scope="col">Published</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {skills.map((skill) => (
                  <tr key={skill.id}>
                    <td>{skill.name}</td>
                    <td>
                      {skill.latest_version === null ? '—' : versionLabel(skill.latest_version)}
                    </td>
                    <td>
                      {skill.latest_version === null
                        ? '—'
                        : formatTimestamp(skill.latest_version.published_at)}
                    </td>
                    <td>
                      <Button
                        type="button"
                        variant={selectedSkillId === skill.id ? 'primary' : 'ghost'}
                        disabled={busy}
                        onClick={() => void loadVersionHistory(skill.id)}
                      >
                        View history
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </LedgerTable>
          ) : null}
        </section>

        <section className="access-panel__card" aria-labelledby="versions-heading">
          <MonoCaps>Immutable versions</MonoCaps>
          <h2 id="versions-heading">
            {selectedSkill === null ? 'Version history' : `${selectedSkill.name} versions`}
          </h2>
          {selectedSkillId === null ? (
            <p>Select a Skill to inspect its immutable published versions.</p>
          ) : null}
          {selectedSkillId !== null && versionsLoading ? (
            <p role="status">Loading versions…</p>
          ) : null}
          {selectedSkillId !== null && !versionsLoading && versions.length === 0 ? (
            <p>No published versions found.</p>
          ) : null}
          {selectedSkillId !== null && !versionsLoading && versions.length > 0 ? (
            <>
              <label className="access-panel__field">
                <span>Version</span>
                <select
                  value={selectedVersionId ?? ''}
                  onChange={(event) => setSelectedVersionId(event.target.value)}
                >
                  {versions.map((version) => (
                    <option key={version.skill_version_id} value={version.skill_version_id}>
                      {versionLabel(version)}
                    </option>
                  ))}
                </select>
              </label>
              {selectedVersion === null ? null : (
                <div className="skills-panel__snapshot">
                  <p className="skills-panel__meta">
                    Published {formatTimestamp(selectedVersion.published_at)} · immutable snapshot
                  </p>
                  <h3>{selectedVersion.title}</h3>
                  <pre className="skills-panel__instructions">{selectedVersion.instructions}</pre>
                </div>
              )}
            </>
          ) : null}
        </section>
      </div>

      <Dialog
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        title="Publish a Skill version"
        description="Publishing creates a new immutable version. Reusing a Skill name increments the version number."
      >
        <label className="access-panel__field">
          <span>Skill name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} />
        </label>
        <label className="access-panel__field">
          <span>Version title</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} />
        </label>
        <label className="access-panel__field">
          <span>Instructions</span>
          <textarea
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            maxLength={32_000}
            rows={8}
          />
        </label>
        <div className="access-panel__actions">
          <Button
            type="button"
            disabled={busy || name.length === 0 || title.length === 0 || instructions.length === 0}
            onClick={() => void handlePublish()}
          >
            Publish version
          </Button>
          <Button type="button" variant="ghost" onClick={() => setPublishOpen(false)}>
            Cancel
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={publishedVersion !== null}
        onClose={() => setPublishedVersion(null)}
        title="Skill version published"
        description="The new version is immutable. Future edits must publish another version."
      >
        {publishedVersion === null ? null : (
          <>
            <p>
              Version <strong>v{publishedVersion}</strong> is now live for this Skill name.
            </p>
            <Button type="button" onClick={() => setPublishedVersion(null)}>
              Continue
            </Button>
          </>
        )}
      </Dialog>
    </main>
  );
}
