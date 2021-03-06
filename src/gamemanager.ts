import * as Slack from "./slack"
import * as GameController from "./gamecontroller"
import * as PlayerController from "./playercontroller"
import Player from "./models/player";
import Game from "./models/game";

export interface DialogueMetadata {
    gameId: number;
    playerId: number;
    turnIdx: number;
}

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
    return Slack.postMessage(game.workspace_id, game.slackchannelid, message);
}

export async function createGame( slackWorkspace: string, slackChannel: string, slackUserId: string ) {
    console.log("Creating game in: " + slackChannel);
    const game = await GameController.createGame(slackWorkspace, slackChannel);
    
    const player = await PlayerController.getOrCreatePlayerWithSlackId(slackUserId, game.id );

    await printGameInfoMessage(game, [player]);
    return game;
}
