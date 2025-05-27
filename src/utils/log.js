export const LOG_LEVELS = {
    MASTER:  "Master",
    SLAVE: "Slave",
    ACTION: "Action",
};

export function log(levelArray, logLevel, ...args) {
    if (!levelArray.includes(logLevel.toString())) {
        return;
    }

    console.log(`[${logLevel}] `, ...args);
}