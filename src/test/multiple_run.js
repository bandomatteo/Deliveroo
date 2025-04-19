// import child_process in ES module
import { spawn } from 'child_process';

import path from 'path';
import { fileURLToPath } from 'url';

const file_name = 'testAgent.js'
const processes = 5

// Function to spawn child processes
function spawnProcesses(num, agent_file_path, log) {
    for ( let i = 0; i < num; i++ ) {
        const name = 'm_' + i;
        
        const childProcess = spawn( `node ${agent_file_path} -name=${name}`, { shell: true } );

        if (log) {
            childProcess.stdout.on('data', data => {
                console.log(`Output from ${name}: ${data}`);
            });

            childProcess.stderr.on('data', data => {
                console.error(`Error from ${name}: ${data}`);
            });

            childProcess.on('close', code => {
                console.log(`Child process ${name} exited with code ${code}`);
            });
        }
    }
}

// Start the processes
// Get __dirname equivalent in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const agentPath = path.resolve(__dirname, `../agent/${file_name}`);

spawnProcesses(processes, agentPath, false);