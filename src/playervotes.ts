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

export async function getPlayerVotePrompt(game: Game, player: Player) {
    const allPlayers = await PlayerController.getPlayersForGame(game.id);
    const mainPlayer = allPlayers.find(p => p.id == game.currentplayerturn);
    const otherPlayers = allPlayers.filter(p => p.id != player.id);

    const chosenGifs = await GifController.getCards(otherPlayers.map(p => p.chosen_gif_id));
    return getVoteMessage(shuffle(chosenGifs), game.currentkeyword, mainPlayer.slack_user_id, game.id, player.id, game.currentturnidx);
}

export async function promptPlayerVotes(game: Game, playerGifs: [Player,Gif][] ) {
    const playersToPrompt = playerGifs.filter(g => g[0].id != game.currentplayerturn);
    const mainPlayer = playerGifs.find(g => g[0].id == game.currentplayerturn)[0];

    // for reach player show them a shuffled list of gifs
    for (const player of playersToPrompt) {
        const otherPlayerGifs = playerGifs.filter(g => g[0].id != player[0].id).map(g => g[1]);
        const voteMessage = getVoteMessage( shuffle( otherPlayerGifs ),
            game.currentkeyword, mainPlayer.slack_user_id, game.id, player[0].id, game.currentturnidx);
        await Slack.postEphemeralMessage(game.slackchannelid, player[0].slack_user_id, voteMessage);
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
    
    respond({ replace_original: true, text: "👌" });
}