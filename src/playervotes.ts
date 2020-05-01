import * as GifController from "./gifcontroller"
import * as Slack from "./slack"
import * as PlayerController from "./playercontroller"
import * as GameController from "./gamecontroller"
import Player from "./models/player";
import * as TurnManager from "./turnmanager"
import { getBigCardSection } from "./turnmanager";
import { Option } from "@slack/web-api";
import Gif from "./models/gif";
import Game from "./models/game";

interface VoteMetadata {
    gameId: number;
    playerId: number;
    turnIdx: number;

    gifId: number;
}

/**
 * Shuffles array in place. ES6 version
 * @param {Array} a items An array containing the items.
 */
function shuffle(a: any[]) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

export const PLAYER_VOTE_ACTION_ID = "player_vote"
function getVoteMessage(gifOptions: Gif[], keyword: string, mainPlayerSlackId: string, gameId: number, playerId: number, turnIdx: number) {

    const message: Slack.Message = {
        text: "Vote!",
        blocks: [
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `🗳Vote for the card that you think <@${mainPlayerSlackId}> chose for the message: *${keyword}* 🗳`
                }
            }
        ]
    }

    // show cards
    const options: Option[] = []
    for (let i = 0; i < gifOptions.length; i++) {
        const card = gifOptions[i];
        const metadata: VoteMetadata = {
            gameId: gameId,
            playerId: playerId,
            turnIdx: turnIdx,
            gifId: card.id
        }

        message.blocks.push( getBigCardSection(card, i + 1));
        options.push({
            text: {
                type: "plain_text",
                text: (i + 1).toString()
            },
            value: JSON.stringify( metadata )
        });
    }

    // show menu
    message.blocks.push({
        type: "actions",
        elements: [
            {
                type: "static_select",
                action_id: PLAYER_VOTE_ACTION_ID,
                options: options
            }
        ]
    });

    return message;
}

export async function promptPlayerVotes(game: Game, allplayers: Player[], allGifs: Gif[] ) {
    const playersToPrompt = allplayers.filter(p => p.id != game.currentplayerturn);
    const mainPlayer = allplayers.find(p => p.id == game.currentplayerturn);

    const playerGifs = []
    for (let i = 0; i < allplayers.length; i++) {
        playerGifs.push({
            player: allplayers[i],
            gif: allGifs[i]
        });
    }

    // for reach player show them a shuffled list of gifs
    for (const player of playersToPrompt) {
        shuffle(playerGifs);
        const voteMessage = getVoteMessage(playerGifs.filter(g => g.player.id != player.id).map(g => g.gif),
            game.currentkeyword, mainPlayer.slack_user_id, game.id, player.id, game.currentturnidx);
        await Slack.sendPm(player.slack_user_id, voteMessage);
    }
}

export async function handlePlayerVote(payload: Slack.ActionPayload, respond: (message: Slack.InteractiveMessageResponse) => void) {
    const voteMetadata = JSON.parse(payload.actions[0].selected_option.value) as VoteMetadata;
    console.log("Player voted for " + voteMetadata.gifId);

    const game = await GameController.getGameForId(voteMetadata.gameId);
    if (game == undefined|| game.currentturnidx != voteMetadata.turnIdx)
        throw new Error("Unknown game");
    if (voteMetadata.playerId == game.currentplayerturn)
        throw new Error("The main player but tried to vote");
    

    await TurnManager.playerVote(game.id, voteMetadata.playerId, voteMetadata.gifId);
    
    // remove vote menu
    const returnMsg = payload.message;
    returnMsg.blocks.pop();
    respond({ replace_original: true, text: "👌" });
}