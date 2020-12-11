
import https from "https";
import {ClientRequest, IncomingMessage} from "http";
import {Client, Collection, Guild, TextChannel, Message} from "discord.js";
import Config from "../config";

let errorAndExit = (err: string) => {
    console.error(err);
    process.exit(1);
}

class LeaderboardDay {
    public star1Time: number;
    public star2Time: number | undefined;

    constructor(data: any) {
        this.star1Time = data["1"].get_star_ts;
        if (data["2"] && data["2"].get_star_ts) this.star2Time = data["2"].get_star_ts;
    }
}

class LeaderboardMember {
    public name: string;
    public starCount: number;
    public lastStarTime: number;
    public score: number;
    public days: Map<string, LeaderboardDay>;

    constructor(data: any) {
        this.name = data.name;
        this.starCount = data.stars;
        this.lastStarTime = parseInt(data.last_star_ts);
        this.score = data.local_score;

        this.days = new Map<string, LeaderboardDay>();
        for (let [dayNo, day] of Object.entries(data.completion_day_level)) this.days.set(dayNo, new LeaderboardDay(day));
    }

    public getFormattedStars(config: Config) {
        const EMOJI_NONE = config.get("EMOJI_NONE");
        const EMOJI_FIRST_ONLY = config.get("EMOJI_FIRST_ONLY");
        const EMOJI_BOTH = config.get("EMOJI_BOTH");

        let stars = [];
        for (let i = 0; i < 25; i++) stars[i] = " ";

        this.days.forEach((day, key) => {
            const dayNo = parseInt(key);
            if (day.star2Time) stars[dayNo - 1] = EMOJI_BOTH;
            else stars[dayNo - 1] = EMOJI_FIRST_ONLY;
        });

        return stars.join('').trimEnd().replace(/ /g, EMOJI_NONE);
    }
}

class LeaderboardResponse {
    public ownerId: string;
    public event: string;
    public members: Map<string, LeaderboardMember>;

    constructor(json: string) {
        let data = JSON.parse(json);
        if (!data) console.error("Failed to parse API response for leaderboard status.");

        this.ownerId = data.owner_id;
        this.event = data.event;

        this.members = new Map<string, LeaderboardMember>();
        for (let [memberId, member] of Object.entries(data.members)) this.members.set(memberId, new LeaderboardMember(member));
    }

    public getSortedMembers(): LeaderboardMember[] {
        let memberList: LeaderboardMember[] = [];
        this.members.forEach(member => memberList[member.score] = member);
        return memberList.reverse();
    }

    public getEmbed(config: Config): any {
        let linkPath = config.get("LEADERBOARD_PATH", false, "/2020/leaderboard/private/view/.json")

        let embed: any = {
            title: `Advent of Code ${this.event} - ${this.members.get(this.ownerId)?.name}'s Leaderboard`,
            timestamp: Date.now(),
            url: `https://adventofcode.com${linkPath.substring(0, linkPath.length - 5)}`,
            color: Math.floor(Math.random() * 2) == 0 ? 12138040 : 2852409,
            fields: []
        }
        
        this.getSortedMembers().forEach(member => {
            embed.fields.push({
                name: `${(embed.fields.length + 1).toString()}: ${member.name}`,
                value: `${member.score.toString()}	${member.getFormattedStars(config)}`
            });
        });

        return embed;
    }
}

export default class Leaderboard {
    public guild: Guild;
    public leaderboardChannel: TextChannel;
    public bot: Client;
    public config: Config;
    public timer: NodeJS.Timeout;

    public static async build(guild: Guild, bot: Client, config: Config): Promise<Leaderboard> {
        console.log("Initialising leaderboard...");

        let channelId: string = config.get("LEADERBOARD_CHANNEL");
        if (channelId == "") {
            let channel: TextChannel = await Leaderboard.createChannel(guild);
            config.set("LEADERBOARD_CHANNEL", channel.id);
            return new Leaderboard(guild, channel, bot, config);
        }

        let channelManager = guild.channels;
        let resolvedId: string | null = channelManager.resolveID(channelId)
        if (!resolvedId) errorAndExit("Couldn't find the leaderboard channel.");

        let channel: TextChannel = channelManager.resolve(resolvedId as string) as TextChannel;
        console.log(`Leaderboard channel found: #${channel.name}`);
        return new Leaderboard(guild, channel, bot, config);
    }

    constructor(guild: Guild, leaderboardChannel: TextChannel, bot: Client, config: Config) {
        this.guild = guild;
        this.leaderboardChannel = leaderboardChannel;
        this.bot = bot;
        this.config = config;
        this.lastLeaderboard = null;

        let updateRate = parseInt(config.get("REQUEST_INTERVAL", true));
        this.timer = setInterval(() => this.updateChannel(), updateRate);
        console.log(`Leaderboard update timer started, it will update every ${updateRate / 1000} seconds.`);

        this.updateChannel();
    }

    public async updateChannel() {
        console.log("Updating the leaderboard...");

        let leaderboardMsg: Message | undefined = await this.findLeaderboard();
        let leaderboard = await this.getLeaderboard();

        if (leaderboardMsg) {leaderboardMsg.edit({embed: leaderboard.getEmbed(this.config)}); return;}
        this.leaderboardChannel.send({embed: leaderboard.getEmbed(this.config)});
    }

    public getLeaderboard(): Promise<LeaderboardResponse> {
        return new Promise((resolve, reject) => {
            let result: string = "";

            let request: ClientRequest = https.request({ 
                hostname: "adventofcode.com",
                path: this.config.get("LEADERBOARD_PATH"),
                method: "GET",
                headers: {"Cookie": `session=${this.config.get("AOC_SESSION_COOKIE")}`}
            },
            (response: IncomingMessage) => {
                response.on("data", (chunk: string) => result += chunk);
                response.on("end", () => resolve(new LeaderboardResponse(result)));
            });

            request.on("error", reject);
            request.end();
        });
    }

    public findLeaderboard(searchLimit: number = 10, removeTrash = true): Promise<Message | undefined> {
        return this.leaderboardChannel.messages.fetch({limit: searchLimit})
        .then(messages => {
            let leaderboardMsg: Message | undefined;

            messages.each(msg => {
                if (msg.author.id != this.bot.user?.id) {
                    if (removeTrash) msg.delete();
                    return;
                }
    
                if (msg.embeds.length > 0) leaderboardMsg = msg;
            });

            return leaderboardMsg;
        });
    }

    private lastLeaderboard: LeaderboardResponse | null;

    private static async createChannel(guild: Guild): Promise<TextChannel> {
        return await guild.channels.create("aoc-leaders", {
            topic: "See the status of the Advent of Code private leaderboard.",
            reason: "Needed for the Advent of Code Leaderboard bot.",
            permissionOverwrites: [
                {
                    id: guild.roles.everyone,
                    deny: ["SEND_MESSAGES"],
                    type: "role"
                }
            ]
        });
    }
}