import path from 'node:path';

import {
  ensureFilesExist,
  fail,
  fromRoot,
  listRepositoryFiles,
  markdownFrontmatter,
  readText,
  readYaml,
  validateSchema,
} from './lib.mjs';

export function collectDocumentErrors({ manifest, sources, today = new Date() }) {
  const errors = [];
  const ids = new Set();
  const paths = new Set();
  const topics = new Map();
  const documentsById = new Map();

  for (const document of manifest.documents ?? []) {
    if (ids.has(document.id)) errors.push(`duplicate document id: ${document.id}`);
    if (paths.has(document.path)) errors.push(`duplicate document path: ${document.path}`);
    ids.add(document.id);
    paths.add(document.path);
    documentsById.set(document.id, document);

    if (['accepted', 'informative', 'generated'].includes(document.status)) {
      for (const topic of document.authority_topics ?? []) {
        if (topics.has(topic)) {
          errors.push(
            `authority topic ${topic} is owned by both ${topics.get(topic)} and ${document.id}`,
          );
        } else {
          topics.set(topic, document.id);
        }
      }
    }

    if (document.kind === 'generated' && !document.generator) {
      errors.push(`generated document ${document.id} has no generator`);
    }
  }

  for (const document of manifest.documents ?? []) {
    for (const supersededId of document.supersedes ?? []) {
      if (!documentsById.has(supersededId)) {
        errors.push(`${document.id} supersedes unknown document ${supersededId}`);
      }
    }
  }

  const visiting = new Set();
  const visited = new Set();
  const visit = (id) => {
    if (visiting.has(id)) {
      errors.push(`supersession cycle includes ${id}`);
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const next of documentsById.get(id)?.supersedes ?? []) visit(next);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of documentsById.keys()) visit(id);

  const sourceIds = new Set();
  for (const source of sources.sources ?? []) {
    if (sourceIds.has(source.id)) errors.push(`duplicate research source id: ${source.id}`);
    sourceIds.add(source.id);
    for (const docId of source.used_by ?? []) {
      if (!documentsById.has(docId))
        errors.push(`${source.id} references unknown document ${docId}`);
    }
    const expiry = new Date(`${source.reverify_after}T23:59:59Z`);
    if (Number.isFinite(expiry.valueOf()) && expiry < today) {
      errors.push(`research source ${source.id} is stale as of ${source.reverify_after}`);
    }
  }

  return errors;
}

export function validateDocs() {
  const manifest = readYaml('docs/MANIFEST.yaml');
  const sources = readYaml('docs/research/sources.yaml');
  const errors = [
    ...validateSchema('governance/schemas/manifest.schema.json', manifest, 'MANIFEST'),
    ...validateSchema(
      'governance/schemas/research-sources.schema.json',
      sources,
      'research sources',
    ),
    ...collectDocumentErrors({ manifest, sources }),
  ];

  const registered = new Set(manifest.documents.map((document) => document.path));
  errors.push(
    ...ensureFilesExist([...registered]).map((file) => `registered file is missing: ${file}`),
  );

  for (const file of listRepositoryFiles(['docs/**/*'])) {
    if (!registered.has(file)) errors.push(`unregistered documentation file: ${file}`);
  }

  const markerPattern = /\b(?:TODO|TBD|FIXME)\b/i;
  for (const document of manifest.documents) {
    if (!document.path.endsWith('.md')) continue;
    if (!registered.has(document.path)) continue;
    const parsed = markdownFrontmatter(document.path);
    const keys = Object.keys(parsed.data);
    if (keys.length !== 1 || keys[0] !== 'doc_id') {
      errors.push(`${document.path} frontmatter must contain only doc_id`);
    }
    if (parsed.data.doc_id !== document.id) {
      errors.push(
        `${document.path} doc_id ${parsed.data.doc_id ?? '<missing>'} does not match ${document.id}`,
      );
    }
    if (document.status === 'accepted' && markerPattern.test(parsed.content)) {
      errors.push(`accepted document contains an unresolved marker: ${document.path}`);
    }
    if (document.kind === 'generated' && !parsed.content.includes('DO NOT EDIT')) {
      errors.push(`generated document lacks DO NOT EDIT marker: ${document.path}`);
    }

    for (const match of parsed.content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      const target = match[1].split('#')[0];
      if (!target || /^(?:https?:|mailto:)/.test(target)) continue;
      const resolved = path.resolve(path.dirname(fromRoot(document.path)), target);
      if (
        !resolved.startsWith(fromRoot('docs')) ||
        !registered.has(path.relative(fromRoot(), resolved).replaceAll('\\', '/'))
      ) {
        errors.push(`broken or unregistered local link in ${document.path}: ${target}`);
      }
    }
  }

  fail(errors, 'Documentation validation failed');
  if (!errors.length)
    console.log(`Documentation authority valid: ${manifest.documents.length} registered files.`);
  return errors;
}

if (
  import.meta.url === `file://${process.argv[1]?.replaceAll('\\', '/')}` ||
  process.argv[1]?.endsWith('validate-docs.mjs')
) {
  validateDocs();
}
