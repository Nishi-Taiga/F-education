import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool, neonConfig } from '@neondatabase/serverless';
import * as schema from '../shared/schema';

// WebSocket is only needed for the Neon serverless driver
if (process.env.NODE_ENV === 'production') {
  // Import is asynchronous in ESM, so we initialize it later
  (async () => {
    const { WebSocket } = await import('ws');
    neonConfig.webSocket = WebSocket;
  })();
} else {
  // In development, we can use the global fetch WebSocket
  neonConfig.fetchConnectionCache = true;
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema });
