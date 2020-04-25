import * as Slack from "./slack"
import * as GameController from "./gamecontroller"
import * as PlayerController from "./playercontroller"
import Player from "./models/player";
import Game from "./models/game";

function getGameInfoMessage(players: Player[]): Slack.Message {
    let playerText = "";
    for (const player of players) {
        playerText += `<@${player.slack_user_id}>\n`;
    }

    const message = {
        text: "Game in progress",
        blocks: [
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: "*Players*\n" + playerText
                }
            }
        ]
    }

    return message;
}

async function printGameInfoMessage(game: Game, players: Player[]) {
    const message = getGameInfoMessage(players);
    return Slack.postMessage(game.slackchannelid, message);
}

async function doPlayerJoin(gameid: number, slackid: string) {
    console.log( "Player joining " + slackid)
    const newplayer = await PlayerController.createPlayer(slackid, gameid);
    return newplayer;
}

export async function createGame( slackChannel: string, slackUserId: string ) {
    console.log("Creating game in: " + slackChannel);
    const game = await GameController.createGame(slackChannel);
    
    const player = await doPlayerJoin(game.id, slackUserId);

    return printGameInfoMessage(game, [player]);
}

export async function joinGame(slackChannel: string, slackUserId: string) {
    console.log("Joining game in: " + slackChannel);
    const game = await GameController.getGameForSlackChannel(slackChannel);
    await doPlayerJoin(game.id, slackUserId);

    const players = await PlayerController.getPlayersForGame(game.id);
    return printGameInfoMessage(game, players);
}
