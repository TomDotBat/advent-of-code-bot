
import schedule from "node-schedule";
import {TextChannel, Message, Client} from "discord.js";

export default class PuzzleAlerter {
    public channel: TextChannel;
    public bot: Client;

    constructor(channel: TextChannel, bot: Client) {
        console.log("Initialising puzzle alerter...");

        this.channel = channel;
        this.bot = bot;

        schedule.scheduleJob("0 5 1-25 12 *", () => this.sendAlert());
    }

    public sendAlert() {
        let date: number = new Date(Date.now()).getDate();
        if (date < 1 || date > 25) return;

        console.log("Alerting members of the new puzzle...");

        this.cleanupChannel(20);
        this.channel.send(`Advent of Code puzzle ${date} has just released!`);
    }

    private cleanupChannel(limit: number): Promise<void> {
        return this.channel.messages.fetch({limit: limit})
        .then(messages => {
            messages.each(msg => {
                if (msg.author.id != this.bot.user?.id) {
                    msg.delete();
                    return;
                }
    
                if (msg.embeds.length > 0) return;
                msg.delete();
            });
        });
    }
}