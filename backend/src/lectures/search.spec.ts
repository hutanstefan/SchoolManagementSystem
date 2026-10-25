import { foldText } from './search';

describe('foldText', () => {
  it('lowers the case and drops diacritics, for searching', () => {
    expect(foldText('Ion Creangă, Amintiri din Copilărie')).toBe(
      'ion creanga, amintiri din copilarie',
    );
    expect(foldText('ȘTIINȚE și țară')).toBe('stiinte si tara');
  });
});
