import logger from "./logger.js";

/**
 * Safely stringify JSON with error handling and fallback
 *
 * Purpose:
 * Prevents streaming from breaking when encountering non-serializable objects
 * (circular references, buffers, undefined, etc.)
 *
 * Implementation Strategy:
 * - Attempts JSON.stringify on input
 * - On failure, returns a safe descriptor object containing error info
 * - Never throws; always returns valid JSON string
 *
 * Usage Examples:
 *   safeJSONStringify({circular: someCircularRef}) → '{"error":"Data serialization failed","originalType":"object"}'
 *   safeJSONStringify(validData) → '{"key":"value"}'
 *
 * @param {*} obj - Object to stringify (any type, including circular/non-serializable)
 * @returns {string} Serialized JSON string (always valid, never throws)
 */
export const safeJSONStringify = (obj) => {
  try {
    return JSON.stringify(obj);
  } catch (stringifyError) {
    logger.error(`JSON stringify error: ${stringifyError.message}`);
    // Return a safe fallback object
    return JSON.stringify({
      error: "Data serialization failed",
      originalType: typeof obj,
    });
  }
};

/**
 * Safely parse JSON with fallback value on failure
 *
 * Purpose:
 * Provides safe parsing with recovery strategy for malformed JSON
 * Used to validate previously serialized data or handle edge cases
 *
 * Implementation Strategy:
 * - Attempts JSON.parse with provided string
 * - On failure, returns fallback value instead of throwing
 * - Useful for defensive parsing in production streams
 *
 * Usage Examples:
 *   safeJSONParse('{"key":"value"}') → {key: "value"}
 *   safeJSONParse('invalid json', []) → []
 *
 * @param {string} jsonString - JSON string to parse
 * @param {*} fallback - Fallback value on parse failure (default: [])
 * @returns {*} Parsed object or fallback value
 */
export const safeJSONParse = (jsonString, fallback = []) => {
  try {
    return JSON.parse(jsonString);
  } catch (parseError) {
    logger.error(`JSON parse error: ${parseError.message}`);
    return fallback;
  }
};

/**
 * Creates standardized metadata object for streaming responses
 *
 * Purpose:
 * Provides consistent response metadata structure across all endpoints
 * Conditionally includes error/result fields using object spread
 *
 * Response Structure:
 * {
 *   success: boolean,
 *   error: string,      // Only if errorMessage provided
 *   result: object      // Only if result provided
 * }
 *
 * Usage Examples:
 *   createMetadata(true) → {success: true}
 *   createMetadata(false, "Timeout") → {success: false, error: "Timeout"}
 *   createMetadata(true, null, {rowsAffected: 5}) → {success: true, result: {rowsAffected: 5}}
 *
 * @param {boolean} success - Operation success status
 * @param {string|null} errorMessage - Error message if any (default: null)
 * @param {*} result - Query result metadata if any (default: null)
 * @returns {Object} Metadata object with conditional fields
 */
export const createMetadata = (success, errorMessage = null, result = null) => ({
  success,
  ...(errorMessage && { error: errorMessage }),
  ...(result && { result }),
});

/**
 * Creates standard HTTP headers for chunked streaming responses
 *
 * Purpose:
 * Centralizes header configuration for all streaming endpoints
 * Ensures consistent Content-Type and transfer semantics
 *
 * Headers:
 * - Content-Type: application/json - Declares JSON content
 * - Transfer-Encoding: chunked - Enables streaming without Content-Length
 * - Cache-Control: no-cache - Prevents caching of live streams
 *
 * @returns {Object} Headers object for res.writeHead()
 */
export const createStreamingHeaders = () => ({
  "Content-Type": "application/json",
  "Transfer-Encoding": "chunked",
  "Cache-Control": "no-cache",
});
