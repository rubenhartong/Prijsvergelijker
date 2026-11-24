export interface Env {
  DB: D1Database;
  API_KEY: string;
  /** Minimale besparing (€) waarvoor een Action-ronde loont (wrangler var). */
  ACTION_DREMPEL?: string;
}
