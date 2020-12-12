
import discord, {Guild, TextChannel} from "discord.js";
import Config from "../config";
import Leaderboard from "./leaderboard";
import PuzzleAlerter from "./puzzle_alerter";

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
        .then((guild: Guild) => {
            if (!guild) errorAndExit("Guild not found with specified ID.");

            this.targetGuild = guild;
            console.log(`Target guild found: ${guild.name}.`);

            return guild;
        })
        .then(async (guild: Guild) => {
            let channelId: string = this.config.get("TARGET_CHANNEL");
            if (channelId == "") {
                this.targetChannel = await this.createChannel();
                this.config.set("TARGET_CHANNEL", this.targetChannel.id);
                return;
            }

            let channelManager = guild.channels;
            let resolvedId: string | null = channelManager.resolveID(channelId)
            if (!resolvedId) errorAndExit("Couldn't find the Advent of Code channel.");

            this.targetChannel = channelManager.resolve(resolvedId as string) as TextChannel;
            console.log(`Advent of Code channel found: #${this.targetChannel?.name}.`);
            return;
        })
        .then(async () => this.leaderboard = new Leaderboard(this.targetChannel as TextChannel, this, this.config))
        .then(() => new PuzzleAlerter(this.targetChannel as TextChannel, this));
    }

    public async createChannel(): Promise<TextChannel> {
        let guild = this.targetGuild as Guild;
        return await guild.channels.create("advent-of-code", {
            topic: "See information about the current Advent of Code event.",
            reason: "Needed for the Advent of Code bot.",
            permissionOverwrites: [
                {
                    id: guild.roles.everyone,
                    deny: ["SEND_MESSAGES"],
                    type: "role"
                }
            ]
        });
    }

    private config: Config;
    private targetGuild: Guild | undefined;
    private targetChannel: TextChannel | undefined;
    private leaderboard: Leaderboard | undefined;
}