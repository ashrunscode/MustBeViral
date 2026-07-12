import { generateDocs } from './generate-docs.mjs';

const drift = generateDocs({ check: true });
if (drift.length) process.exitCode = 1;
