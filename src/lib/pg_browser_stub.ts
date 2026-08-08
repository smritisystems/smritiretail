/**
 * Browser stub for 'pg' module.
 * Direct PostgreSQL TCP connections from browser frontend UI are prohibited.
 * Browser frontend uses HTTP API calls (/api/v1).
 */

export class Pool {
  constructor() {}
  async query() {
    throw new Error("[SMRITI DB] Direct PostgreSQL TCP queries from browser UI are prohibited. Use backend API.");
  }
  async connect() {
    throw new Error("[SMRITI DB] Direct PostgreSQL TCP connections from browser UI are prohibited. Use backend API.");
  }
  on() {}
}

export class Client {
  constructor() {}
  async query() {
    throw new Error("[SMRITI DB] Direct PostgreSQL TCP queries from browser UI are prohibited. Use backend API.");
  }
  async connect() {
    throw new Error("[SMRITI DB] Direct PostgreSQL TCP connections from browser UI are prohibited. Use backend API.");
  }
  on() {}
}

export const types = {
  setTypeParser: () => {},
  getTypeParser: () => {},
};

export default {
  Pool,
  Client,
  types,
};
