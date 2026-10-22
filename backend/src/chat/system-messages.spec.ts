import { listNames, systemMessages } from './system-messages';

describe('system messages', () => {
  it('lists names like a person would', () => {
    expect(listNames(['Ana'])).toBe('Ana');
    expect(listNames(['Ana', 'Ion'])).toBe('Ana and Ion');
    expect(listNames(['Ana', 'Ion', 'Dan'])).toBe('Ana, Ion and Dan');
    expect(listNames(['Ana', 'Ion', 'Dan', 'Eva'])).toBe(
      'Ana, Ion, Dan and 1 other',
    );
    expect(listNames(['Ana', 'Ion', 'Dan', 'Eva', 'Ilie'])).toBe(
      'Ana, Ion, Dan and 2 others',
    );
  });

  it('describes what happened in a group', () => {
    expect(systemMessages.created('Mihai Ionescu', '9A · Maths')).toBe(
      'Mihai Ionescu created the group “9A · Maths”',
    );
    expect(systemMessages.added('Mihai Ionescu', ['Ana Pop', 'Ion Rus'])).toBe(
      'Mihai Ionescu added Ana Pop and Ion Rus',
    );
    expect(systemMessages.left('Ana Pop')).toBe('Ana Pop left the group');
  });
});
