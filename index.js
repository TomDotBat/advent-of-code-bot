
require("dotenv").config();
const discord = require("discord.js");
const https = require("https");

const bot = new discord.Client();

let errorAndExit = err => {
    console.error(err);
    process.exit(1);
};

let targetGuild;
let leaderboardChannel;
let requestTimer;

let getLeaderboardChannel = () => {
    let channelManager = targetGuild.channels;
    let channelId = process.env.LEADERBOARD_CHANNEL;

    if (!channelId) {
        channelManager.create("aoc-leaders", {
            topic: "See the status of the Advent of Code private leaderboard.",
            reason: "Needed for the Advent of Code Leaderboard bot.",
            permissionOverwrites: [
                {
                    id: targetGuild.roles.everyone,
                    deny: ["SEND_MESSAGES"],
                    type: "role"
                }
            ]
        })
        .then(channel => {
            if (!channel) errorAndExit("Failed to create the leaderboard channel automatically.");
            console.log(`Created leaderboard channel: #${channel.name}`);

            let id = channel.id;
            process.env.LEADERBOARD_CHANNEL = id;

            require("fs").appendFile(".env", `\nLEADERBOARD_CHANNEL=${id}`, err => {
                if (err) errorAndExit(err);
                console.log("Saved new leaderboard channel to the config.");
            });
            
            getLeaderboardChannel();
        })
        .catch(errorAndExit);

        return;
    };

    leaderboardChannel = channelManager.resolve(channelManager.resolveID(process.env.LEADERBOARD_CHANNEL));
    console.log(`Leaderboard channel found: #${leaderboardChannel.name}`);
};

let getTargetGuild = callback => {
    bot.guilds.fetch(process.env.TARGET_GUILD, true, true)
    .then(guild => {
        if (!guild) errorAndExit("Guild not found with specified ID.");

        targetGuild = guild;
        console.log(`Target guild found: ${guild.name}`);
        if (callback) callback(guild);
    })
    .catch(errorAndExit);
};

let requestOptions = { 
    hostname: "adventofcode.com",
    path: process.env.LEADERBOARD_PATH,
    method: "GET",
    headers: {"Cookie": `session=${process.env.AOC_SESSION_COOKIE}`}
};

let getLeaderboardStats = callback => {
    let result = ""; 
    let request = https.request(requestOptions, response => {
        response.on("data", chunk => result += chunk);
        response.on("end", () => {
            try {result = JSON.parse(result);}
            catch (err) {console.error(err);};

            if (callback) callback(result);
        }); 
    });
    
    request.on("error", console.error);
    request.end();
};

let updateLeaderboardChannel = (stats, skipCleanup, editMessage) => {
    if (!stats) {
        getLeaderboardStats(updateLeaderboardChannel);
        return;
    };

    if (!skipCleanup) {
        leaderboardChannel.messages.fetch({limit: 10})
        .then(messages => {
            let editMessage;
            messages.each(msg => {
                if (msg.author.id != bot.user.id) {
                    msg.delete();
                    return;
                };
    
                if (msg.embeds.length > 0) editMessage = msg;
            });
            updateLeaderboardChannel(stats, true, editMessage);
        })
        .catch(console.error);
        return;
    }

    let owner = stats.members[stats.owner_id];
    let leaders = [];

    let sortedMemberIds = Object.keys(stats.members).sort((a, b) => {
        return stats.members[a].local_score - stats.members[b].local_score;
    }).reverse();

    for (let i = 0; i < sortedMemberIds.length; i++) {
        const member = stats.members[sortedMemberIds[i]];

        let stars = [];
        for (let j = 0; j < 25; j++) stars[j] = " ";

        for (let [dayNo, day] of Object.entries(member.completion_day_level)) {
            dayNo = parseInt(dayNo);
            
            if (day["2"]) stars[dayNo - 1] = process.env.EMOJI_BOTH;
            else stars[dayNo - 1] = process.env.EMOJI_FIRST_ONLY;
        };

        stars = stars.join('').trimEnd();
        stars = stars.replaceAll(" ", process.env.EMOJI_NONE);

        leaders[leaders.length] = {
            name: `${(leaders.length + 1).toString()}: ${member.name}`,
            value: member.local_score.toString().padEnd(5) + " " + stars
        };
    };

    let embed = {
        embed: {
            title: `Advent of Code ${stats.event} - ${owner.name}'s Leaderboard`,
            timestamp: Date.now(),
            url: `https://adventofcode.com${process.env.LEADERBOARD_PATH.substring(0, process.env.LEADERBOARD_PATH.length - 5)}`,
            color: Math.floor(Math.random() * 2) == 0 ? 12138040 : 2852409,
            fields: leaders
        }
    };

    if (editMessage) editMessage.edit(embed);
    else leaderboardChannel.send(embed);
};

bot.on("ready", () => {
    console.log(`Logged in as: ${bot.user.tag}`);
    getTargetGuild(getLeaderboardChannel);

    updateLeaderboardChannel();
    requestTimer = setInterval(updateLeaderboardChannel, process.env.REQUEST_INTERVAL);
});

bot.on("message", msg => {
    if (msg.content != "tom.ping") return;
    msg.reply("pong!").then(m => m.edit(`Ping: \`\`${m.createdTimestamp - msg.createdTimestamp}ms\`\``));
});

bot.login(process.env.BOT_TOKEN);