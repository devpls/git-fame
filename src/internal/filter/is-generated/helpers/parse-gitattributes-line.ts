export interface ParsedGitattributes {
  pattern: string;
  attrs: { 'linguist-generated'?: boolean; 'linguist-vendored'?: boolean };
}

const KNOWN_ATTRS = ['linguist-generated', 'linguist-vendored'] as const;
type KnownAttr = (typeof KNOWN_ATTRS)[number];

const isKnownAttr = (name: string): name is KnownAttr =>
  (KNOWN_ATTRS as readonly string[]).includes(name);

const parseAttrToken = (token: string): { name: KnownAttr; value: boolean } | null => {
  const eqIndex = token.indexOf('=');
  if (eqIndex === -1) {
    if (!isKnownAttr(token)) {
      return null;
    }
    return { name: token, value: true };
  }
  const name = token.slice(0, eqIndex);
  const rawValue = token.slice(eqIndex + 1);
  if (!isKnownAttr(name)) {
    return null;
  }
  return { name, value: rawValue !== 'false' };
};

export const parseGitattributesLine = (raw: string): ParsedGitattributes | null => {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.startsWith('#')) {
    return null;
  }

  const tokens = trimmed.split(/\s+/);
  if (tokens.length < 2) {
    return null;
  }

  const pattern = tokens[0] ?? '';
  const attrs: ParsedGitattributes['attrs'] = {};
  let foundKnown = false;

  for (let i = 1; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token === undefined) {
      continue;
    }
    const parsed = parseAttrToken(token);
    if (parsed === null) {
      continue;
    }
    attrs[parsed.name] = parsed.value;
    foundKnown = true;
  }

  if (!foundKnown) {
    return null;
  }

  return { pattern, attrs };
};
