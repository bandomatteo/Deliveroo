import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

//TODO: Not very elegant, FIXME
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