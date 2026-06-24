import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

interface ContractFixture {
  route: string;
  response: {
    code?: number;
    data?: unknown;
  } | null;
}

const fixtureRoot = join(__dirname, 'fixtures');

function listFixtureFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? listFixtureFiles(path) : [path];
  }).filter((path) => path.endsWith('.json'));
}

describe('LadiPage contract fixtures', () => {
  const fixtureFiles = listFixtureFiles(fixtureRoot);

  it('exports enough phase fixtures for gap-closure coverage', () => {
    expect(fixtureFiles.length).toBeGreaterThanOrEqual(15);
  });

  it.each(fixtureFiles)('%s is a valid captured 200 response', (path) => {
    const fixture = JSON.parse(readFileSync(path, 'utf8')) as ContractFixture;
    expect(fixture.response?.code).toBe(200);
    expect(fixture.response).toHaveProperty('data');
  });
});
