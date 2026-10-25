import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AUDIT_ACTIONS, routeKey } from './audit-actions';
import {
  changedFields,
  createdFields,
  deletedFields,
  describe as describeRecord,
  flattenData,
  HIDDEN,
  normalize,
} from './audit-changes';

describe('activity log routes', () => {
  it('names every route of the API that changes something', () => {
    const openapi = JSON.parse(
      readFileSync(join(__dirname, '../../../docs/openapi.json'), 'utf8'),
    ) as { paths: Record<string, Record<string, unknown>> };
    const missing: string[] = [];
    for (const [path, operations] of Object.entries(openapi.paths)) {
      for (const method of Object.keys(operations)) {
        if (!['post', 'put', 'patch', 'delete'].includes(method)) continue;
        const key = `${method.toUpperCase()} ${path}`;
        if (!(key in AUDIT_ACTIONS)) missing.push(key);
      }
    }
    expect(missing).toEqual([]);
  });

  it('turns Express route paths into OpenAPI ones', () => {
    expect(routeKey('patch', '/api/grades/:id')).toBe('PATCH /api/grades/{id}');
    expect(routeKey('DELETE', '/api/classes/:id/students/:studentId')).toBe(
      'DELETE /api/classes/{id}/students/{studentId}',
    );
  });
});

describe('activity log changes', () => {
  it('keeps values short and JSON-safe', () => {
    expect(normalize(new Date('2026-10-25T10:00:00Z'))).toBe(
      '2026-10-25T10:00:00.000Z',
    );
    expect(normalize({ increment: 1 })).toBe('+1');
    expect(normalize({ set: 'x' })).toBe('x');
    expect(normalize(undefined)).toBeNull();
    expect((normalize('a'.repeat(500)) as string).length).toBe(201);
  });

  it('reads the fields a write sets, with connected and nested records', () => {
    expect(
      flattenData({
        registrationNumber: '2026-0001',
        user: {
          create: { firstName: 'Ana', lastName: 'Pop', passwordHash: 'h' },
        },
        class: { connect: { id: 'c-1' } },
        grades: { createMany: { data: [] } },
        skipped: undefined,
      }),
    ).toEqual({
      registrationNumber: '2026-0001',
      'user.firstName': 'Ana',
      'user.lastName': 'Pop',
      'user.passwordHash': 'h',
      classId: 'c-1',
    });
  });

  it('never logs passwords', () => {
    expect(createdFields({ 'user.passwordHash': 'h', email: 'a@b.c' })).toEqual(
      { 'user.passwordHash': [null, HIDDEN], email: [null, 'a@b.c'] },
    );
    expect(
      changedFields({ passwordHash: 'old' }, { passwordHash: 'new' }),
    ).toEqual({ passwordHash: [HIDDEN, HIDDEN] });
    expect(
      deletedFields({ id: 'u-1', passwordHash: 'h', email: 'a@b.c' }),
    ).toEqual({
      passwordHash: [HIDDEN, null],
      email: ['a@b.c', null],
    });
  });

  it('keeps only the fields an update really changes', () => {
    expect(
      changedFields(
        { value: 7, date: new Date('2026-10-01'), updatedAt: new Date() },
        { value: 9, date: new Date('2026-10-01'), updatedAt: new Date() },
      ),
    ).toEqual({ value: [7, 9] });
  });

  it('names records with the names of what they point to', () => {
    const names = { 's-1': 'Andrei Georgescu', 'm-1': 'Mathematics' };
    expect(
      describeRecord(
        'Grade',
        { value: 9, studentId: 's-1', subjectId: 'm-1' },
        names,
      ),
    ).toBe('9 in Mathematics for Andrei Georgescu');
    expect(
      describeRecord(
        'Student',
        { 'user.firstName': 'Ana', 'user.lastName': 'Pop' },
        {},
      ),
    ).toBe('Ana Pop');
    expect(describeRecord('SchoolYear', { startYear: 2026 }, {})).toBe(
      '2026–2027',
    );
    expect(describeRecord('Grade', {}, {})).toBeNull();
  });
});
