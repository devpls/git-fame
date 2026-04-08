export const stripAngleBrackets = (mail: string): string => {
  if (!mail.startsWith('<') || !mail.endsWith('>')) {
    return mail;
  }
  return mail.slice(1, -1);
};
