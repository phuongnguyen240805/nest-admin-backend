 import { parseName } from './parse-name';

describe('parseName', () => {
  it('parses simple full name', () => {
    expect(parseName('Nguyen Van An')).toEqual({
      firstName: 'Nguyen',
      lastName: 'Van An',
      fullName: 'Nguyen Van An',
    });
  });

  it('handles single name', () => {
    expect(parseName('An')).toEqual({
      firstName: 'An',
      lastName: '',
      fullName: 'An',
    });
  });

  it('handles null/empty', () => {
    expect(parseName(null)).toEqual({ firstName: '', lastName: '', fullName: '' });
    expect(parseName('   ')).toEqual({ firstName: '', lastName: '', fullName: '' });
  });

  it('trims extra spaces', () => {
    expect(parseName('  Le   Thi  B  ')).toEqual({
      firstName: 'Le',
      lastName: 'Thi B',
      fullName: 'Le Thi B',
    });
  });

  it('normalizes multiple internal spaces in fullName', () => {
    expect(parseName('  John   Doe   Jr  ')).toEqual({
      firstName: 'John',
      lastName: 'Doe Jr',
      fullName: 'John Doe Jr',
    });
  });
});