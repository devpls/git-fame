export interface MailmapEntry {
  proper: { name: string; email: string };
  commit: { name: string | undefined; email: string };
}

export interface Mailmap {
  canonicalize(name: string, email: string): { name: string; email: string };
}
