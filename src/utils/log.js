export const LOG_LEVELS = {
    AGENT:  "Agent",
    ACTION: "Action",
    AGENT2: "Agent2",
};

export function log(levelArray, logLevel, ...args) {
    if (!levelArray.includes(logLevel.toString())) {
        return;
    }

    console.log(`[${logLevel}] `, ...args);
}