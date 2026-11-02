import { DatabaseSync, type StatementSync } from "node:sqlite";

type Value = null | number | bigint | string | Uint8Array;

/** A D1-compatible statement on top of node:sqlite. */
export class D1Statement {
  private readonly statement: StatementSync;
  private readonly values: Value[];

  constructor(statement: StatementSync, values: Value[] = []) {
    this.statement = statement;
    this.values = values;
  }

  bind(...values: unknown[]) {
    return new D1Statement(this.statement, values as Value[]);
  }

  async first<T>(): Promise<T | null> {
    return (this.statement.get(...this.values) as T | undefined) ?? null;
  }

  async all<T>(): Promise<{ results: T[] }> {
    return { results: this.statement.all(...this.values) as T[] };
  }

  async run(): Promise<{ meta: { changes: number } }> {
    return { meta: { changes: Number(this.statement.run(...this.values).changes) } };
  }
}

/** The subset of the D1 database API that the Worker uses, backed by a local SQLite file. */
export class D1Database {
  readonly sqlite: DatabaseSync;

  constructor(path: string) {
    this.sqlite = new DatabaseSync(path);
    this.sqlite.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  }

  prepare(query: string) {
    return new D1Statement(this.sqlite.prepare(query));
  }

  /** Runs all statements in one transaction, like D1: any failure rolls everything back. */
  async batch(statements: D1Statement[]) {
    this.sqlite.exec("BEGIN");
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      this.sqlite.exec("COMMIT");
      return results;
    } catch (error) {
      this.sqlite.exec("ROLLBACK");
      throw error;
    }
  }

  exec(sql: string) {
    this.sqlite.exec(sql);
  }

  close() {
    this.sqlite.close();
  }
}
