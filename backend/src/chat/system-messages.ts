/** The text of the messages the app writes in a group. Pure, unit-tested. */

/** Names listed in full before "and N others". */
const LISTED = 3;

/** ["Ana", "Ion", "Dan", "Eva", "Ilie"] -> "Ana, Ion, Dan and 2 others" */
export function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length <= LISTED) {
    return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  }
  const others = names.length - LISTED;
  return `${names.slice(0, LISTED).join(', ')} and ${others} ${others === 1 ? 'other' : 'others'}`;
}

export const systemMessages = {
  created: (actor: string, group: string) =>
    `${actor} created the group “${group}”`,
  renamed: (actor: string, group: string) =>
    `${actor} renamed the group to “${group}”`,
  added: (actor: string, names: string[]) =>
    `${actor} added ${listNames(names)}`,
  removed: (actor: string, name: string) => `${actor} removed ${name}`,
  left: (name: string) => `${name} left the group`,
};
