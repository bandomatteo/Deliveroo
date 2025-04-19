import { config } from 'dotenv';
import path from 'path';

const envLoaded = config({ path: path.resolve(process.cwd(), '.env') });  

if (envLoaded.error) {
    console.error("❌ Error loading .env:", envLoaded.error);
} else {
    console.log("✅ .env loaded successfully");
}

const CONFIG = {
    host: process.env.HOST,
    token: process.env.TOKEN 
}

console.log("Config loaded:", CONFIG); 
export default CONFIG;