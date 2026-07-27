import { randomUUID } from 'node:crypto';

/** Short, readable, collision-free id. */
export function newId(prefix = 'id'): string {
  return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
}
