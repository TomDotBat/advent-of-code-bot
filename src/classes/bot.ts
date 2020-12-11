
import discord, { Guild } from "discord.js";
import Config from "../config";
import Leaderboard from "./leaderboard";

let errorAndExit = (err: string) => {
    console.error(err);
    process.exit(1);
}

export default class Bot extends discord.Client {
    constructor(options: Object = {}) {
        super(options);
        console.log("Initialising bot...");

        this.config = new Config();
        this.login(this.config.get("BOT_TOKEN", true));
    }

    public setup() {
        this.guilds.fetch(this.config.get("TARGET_GUILD", true))
        .then(guild => {
            if (!guild) errorAndExit("Guild not found with specified ID.");

            this.targetGuild = guild;
            console.log(`Target guild found: ${guild.name}`);

            return guild;
        })
        .then(async guild => {this.leaderboard = await Leaderboard.build(guild, this, this.config)});
    }

    private config: Config;
    private targetGuild: Guild | undefined;
    private leaderboard: Leaderboard | undefined;
}