/**
 * @module log
 * @description
 * This module provides a logging utility for different log levels in a game or application.
 * It defines constants for various log levels such as Master, Slave, and Action.
 * The `log` function allows logging messages at specified levels, filtering out messages that do not match the provided log level.
 * @property {Object} LOG_LEVELS - An object containing constants for each log level.
 * @property {string} LOG_LEVELS.MASTER - Represents the master log level.
 * @property {string} LOG_LEVELS.SLAVE - Represents the slave log level.
 * @property {string} LOG_LEVELS.ACTION - Represents the action log level.
 * @example
 * // Example usage:
 * import { log, LOG_LEVELS } from './log';
 * log([LOG_LEVELS.MASTER, LOG_LEVELS.SLAVE], LOG_LEVELS.MASTER, "This is a master log message.");
 * log([LOG_LEVELS.SLAVE], LOG_LEVELS.SLAVE, "This is a slave log message.");
 * log([LOG_LEVELS.ACTION], LOG_LEVELS.ACTION, "This is an action log message.");
 */
export const LOG_LEVELS = {
    MASTER:  "Master",
    SLAVE: "Slave",
    ACTION: "Action",
};


/**
 * Logs messages to the console based on the specified log level.
 * @param {Array<string>} levelArray - An array of log levels to filter the messages.
 * @param {string} logLevel - The log level to check against the levelArray.
 * @param {...any} args - The messages to log. These can be any type of data that can be logged to the console.
 * @description
 * This function checks if the provided log level exists in the levelArray.
 * If it does, it logs the messages to the console with the specified log level prefix.
 * The log messages are formatted with the log level in square brackets followed by the message.
 * This is useful for filtering log messages based on their importance or category.
 * @returns {void}
 */
export function log(levelArray, logLevel, ...args) {
    if (!levelArray.includes(logLevel.toString())) {
        return;
    }

    console.log(`[${logLevel}] `, ...args);
}