export const LOG_LEVELS = {
    AGENT:  "Agent",
    ACTION: "Action",
};

export function log(levelArray, logLevel, ...args) {
    if (!levelArray.includes(logLevel.toString())) {
        return;
    }

    console.log(`[${logLevel}] `, ...args);
}