/**
 * Debug utility module
 * Provides namespace-based debug logging using the debug package
 * Enable specific namespaces by setting DEBUG environment variable
 * 
 * @module utils/debug
 * @example
 * // Enable all debug output
 * DEBUG=express-mssql-pooling:* npm start
 * 
 * // Enable only server logs
 * DEBUG=express-mssql-pooling:server npm start
 * 
 * // Multiple namespaces
 * DEBUG=express-mssql-pooling:mssql,express-mssql-pooling:application npm start
 */
import debugLib from 'debug';

// Load package.json to get the module name
/*
import pkg from './package.json' with { type: 'json' }; 
     - happens once at module load, is synchronous, cached, 
        and avoids extra filesystem boilerplate. 
        Ideal for config constants like name, version, etc.

fs.promises.readFile (or readFileSync) 
     - makes sense when the JSON content changes at runtime, 
        you need to handle failures dynamically, or 
        you don’t want it bundled.
*/


import pkg from '../../package.json' with { type: 'json' };

const MODULE_NAME = pkg?.name ?? 'express-mssql-pooling';

/**
 * Create a namespaced debugger
 * @param {string} namespace - Debug namespace
 * @returns {Function} Debug function for the namespace
 * @private
 */
const createDebugger = (namespace) => debugLib(namespace);

/** Debug logger for server-related operations */
const debugServer = createDebugger(`${MODULE_NAME}:server`);
/** Debug logger for application initialization and lifecycle */
const debugApplication = createDebugger(`${MODULE_NAME}:application`);
/** Debug logger for route handling and middleware */
const debugRoutes = createDebugger(`${MODULE_NAME}:route`);
/** Debug logger for database and MSSQL operations */
const debugMSSQL = createDebugger(`${MODULE_NAME}:mssql`);


export { debugServer, debugApplication, debugRoutes, debugMSSQL };
export default createDebugger;