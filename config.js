import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * @module config
 * @description
 * This script loads environment variables from a .env file.
 * It checks multiple possible paths for the .env file and loads the first one that exists.
 * If no .env file is found, it logs an error message with the attempted paths.
 * The loaded configuration is then exported for use in other parts of the application. 
 * * @property {Object} CONFIG - An object containing the loaded configuration.
 * @property {string} CONFIG.host - The host value from the .env file.
 * @property {string} CONFIG.token - The token value from the .env file.
 * @property {string} CONFIG.tokenSlave - The tokenSlave value from the .env file.
 * @example
 * import CONFIG from './config.js';
 * console.log(CONFIG.host); // Outputs the host value from the .env file
 */
const possiblePaths = [
  path.resolve(process.cwd(), '.env'),                  
  path.resolve(process.cwd(), 'src/agent/.env'),        
  path.resolve(__dirname, '.env'),                      
  path.resolve(__dirname, '../.env'),                   
  path.resolve(__dirname, '../../.env'),                
];


let envLoaded;
let loadedPath = null;

for (const envPath of possiblePaths) {
  if (fs.existsSync(envPath)) {
    envLoaded = config({ path: envPath });
    loadedPath = envPath;
    break;
  }
}

if (!loadedPath) {
  console.error("❌ Error loading .env file. Tried the following paths:");
  possiblePaths.forEach(p => console.error(`  - ${p}`));
} else {
  console.log(`✅ .env loaded successfully from: ${loadedPath}`);
}

const CONFIG = {
  host: process.env.HOST,
  token: process.env.TOKEN ,
  tokenSlave: process.env.TOKEN_SLAVE,
}

console.log("Config loaded:", CONFIG); 
export default CONFIG;