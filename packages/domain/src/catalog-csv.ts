export const CATALOG_CSV_MAX_ROWS = 40;
export const CATALOG_CSV_MAX_CHARS = 32_768;
export const catalogKinds = ['offering', 'location', 'fact', 'offer', 'language'] as const;
export type CatalogKind = (typeof catalogKinds)[number];
export interface CatalogRow {
  readonly kind: CatalogKind;
  readonly field: string;
  readonly value: string;
  readonly endsAt: string;
  readonly row: number;
}

/** Bounded RFC-style CSV subset: explicit columns, quoted commas/newlines, no formulas. */
export function parseCatalogCsv(input: string): readonly CatalogRow[] {
  if (input.length > CATALOG_CSV_MAX_CHARS) throw new Error('SOURCE_TOO_LARGE');
  const text = input.replace(/^\uFEFF/u, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let closedQuote = false;
  const pushField = () => {
    row.push(field);
    field = '';
    closedQuote = false;
  };
  const pushRow = () => {
    pushField();
    if (row.some((value) => value.length > 0)) rows.push(row);
    row = [];
    if (rows.length > CATALOG_CSV_MAX_ROWS + 1) throw new Error('SOURCE_TOO_LARGE');
  };
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]!;
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
          closedQuote = true;
        }
      } else field += char;
    } else if (char === ',') pushField();
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      pushRow();
    } else if (char === '"' && field.length === 0 && !closedQuote) quoted = true;
    else {
      if (closedQuote || char === '"') throw new Error('SOURCE_MALFORMED');
      field += char;
    }
    if (field.length > 8000 || row.length > 4) throw new Error('SOURCE_TOO_LARGE');
  }
  if (quoted) throw new Error('SOURCE_MALFORMED');
  if (field.length > 0 || row.length > 0 || closedQuote) pushRow();
  const header = rows.shift();
  if (
    !header ||
    !['kind,field_key,value', 'kind,field_key,value,ends_at'].includes(header.join(',')) ||
    rows.length === 0
  ) {
    throw new Error('SOURCE_MALFORMED');
  }
  return rows.map((cells, index) => {
    if (cells.length !== header.length) throw new Error('SOURCE_MALFORMED');
    const [kind, key, value = '', endsAt = ''] = cells;
    if (value.length > 4000) throw new Error('SOURCE_TOO_LARGE');
    if (
      !(catalogKinds as readonly string[]).includes(kind ?? '') ||
      !/^[a-z0-9][a-z0-9_-]{0,119}$/u.test(key ?? '') ||
      /^\s*=/u.test(value) ||
      (kind !== 'offer' && endsAt.length > 0) ||
      endsAt.length > 100
    ) {
      throw new Error('SOURCE_MALFORMED');
    }
    return { kind: kind as CatalogKind, field: key!, value, endsAt, row: index + 2 };
  });
}
