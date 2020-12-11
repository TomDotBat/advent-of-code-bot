
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

export default class Config {
    private settings: dotenv.DotenvParseOutput;

    constructor() {
        const result = dotenv.config();

        if (result.error || result.parsed === undefined) {
            console.error("An error occured while parsing the .env file, exiting...");
            process.exit(1);
        }

        this.settings = result.parsed;
    }

    public get(key: string, exitOnError: boolean = false, fallback: string = "") {
        let val: string | undefined = this.settings[key];
        if (val) return val;
    
        console.error(`The key "${key}" was not found in the config.`);
    
        if (!exitOnError) return fallback;
        process.exit(1);
    }

    public set(key: string, val: string): Promise<boolean> {
        return new Promise(resolve => {
            this.settings[key] = val;
    
            let data: string[] = fs.readFileSync(".env", "utf8").split("\n");
    
            let incrementer: number = 0; 
            let foundKey: boolean = data.every(line => {
                if (line.startsWith(key)) {
                    data[incrementer] = `${key}=${val}`;
                    return false;
                }
    
                incrementer++;
                return true;
            });
    
            if (!foundKey) {
                fs.appendFileSync(".env", `\n${key}=${val}`, "utf8")
                resolve(true);
                return;
            }
    
            fs.writeFileSync(".env", data.join("\n"));
            resolve(true);
        });
    }
}