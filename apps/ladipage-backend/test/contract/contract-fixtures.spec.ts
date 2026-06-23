import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

interface ContractFixture {
  route: string;
  response: {
    code?: number;
    data?: unknown;
  } | null;
}

const fixtureRoot = join(__dirname, 'fixtures');
const pilotFixtures = [
  'phase2/order__list-order.json',
  'phase3/customer__list.json',
  'phase4/report__overview.json',
];

describe('LadiPage contract fixtures', () => {
  it.each(pilotFixtures)('%s is a valid captured 200 response', (relativePath) => {
    const path = join(fixtureRoot, relativePath);
    expect(existsSync(path)).toBe(true);

    const fixture = JSON.parse(readFileSync(path, 'utf8')) as ContractFixture;
    expect(fixture.response?.code).toBe(200);
    expect(fixture.response).toHaveProperty('data');
  });
});
