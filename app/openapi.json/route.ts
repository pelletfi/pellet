/**
 * GET /openapi.json
 *
 * Root-level discovery endpoint for MPP clients. Agents calling
 * `tempo wallet services` and MPPScan probe `/openapi.json` at the service
 * base URL to discover available endpoints and payment info. This route
 * re-exports the same OpenAPI spec served at /api/openapi so both paths
 * resolve to the same document.
 */

export { GET } from "../api/openapi/route";
