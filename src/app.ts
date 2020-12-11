
import Bot from "./classes/bot";

const bot = new Bot();

bot.on("ready", () => {
    console.log(`Logged in as: ${bot.user?.tag}`);
    bot.setup();
});

bot.on("message", msg => {
    if (msg.content != "tom.ping") return;
    msg.reply("pong!").then(m => m.edit(`Ping: \`\`${m.createdTimestamp - msg.createdTimestamp}ms\`\``));
});