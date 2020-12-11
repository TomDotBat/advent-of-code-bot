
import schedule from "node-schedule";
import {TextChannel} from "discord.js";

export default class PuzzleAlerter {
    public channel: TextChannel;

    constructor(channel: TextChannel) {
        console.log("Initialising puzzle alerter...");

        this.channel = channel;
        let job: schedule.Job = schedule.scheduleJob("0 5 1-25 12 *", () => this.sendAlert());
    }

    public sendAlert() {
        let date: number = new Date(Date.now()).getDate();
        if (date < 1 || date > 25) return;

        console.log("Alerting members of the new puzzle...");
        this.channel.send(`Advent of Code puzzle ${date} has just released!`);
    }
}