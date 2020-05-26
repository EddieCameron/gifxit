import * as GifController from "./gifcontroller"
import * as Slack from "./slack"
import * as PlayerController from "./playercontroller"
import * as GameController from "./gamecontroller"
import Player from "./models/player";
import * as TurnManager from "./turnmanager"
import { Option, View } from "@slack/web-api";
import Gif from "./models/gif";
import Game from "./models/game";
import { DialogueMetadata } from "./gamemanager";

/**
 * Shuffles array in place. ES6 version
 * @param {Array} a items An array containing the items.
 */
export function shuffle(a: any[]) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

export const OPEN_VOTE_DIALOGUE_CALLBACK_ID = "open_vote_dialogue";
function getPromptStartVoteMessage(game: Game, playerId: number, mainPlayerSlackId: string, keyword: string, voteEndTime: Date) {
    const metadata: DialogueMetadata = {
        gameId: game.id,
        playerId: playerId,
        turnIdx: game.currentturnidx,
    }

    return {
        text: "Vote!",
        blocks: [{
            type: "section",
            text: {
                type: "mrkdwn",
                text: `🗳 You have until <!date^${voteEndTime.getTime()/1000|0}^{time}|${voteEndTime.toTimeString()}> to vote for the card that you think <@${mainPlayerSlackId}> chose for the message: *${keyword}* 🗳`
            },
            accessory: {
                type: "button",
                text: {
                    type: "plain_text",
                    text: "Vote!"
                },
                style: "primary",
                value: JSON.stringify(metadata),
                action_id: OPEN_VOTE_DIALOGUE_CALLBACK_ID
            }
        }
        ]
    } as Slack.Message;
}

export const PLAYER_VOTE_ACTION_ID = "player_vote"
const PLAYER_VOTE_BLOCK_ID = "player_vote_block"
function getVoteDialogue(gifOptions: Gif[], keyword: string, mainPlayerSlackId: string, gameId: number, playerId: number, turnIdx: number) {
    const metadata: DialogueMetadata = {
        gameId: gameId,
        playerId: playerId,
        turnIdx: turnIdx,
    } 

    const dialogue: View = {
        type: "modal",
        callback_id: PLAYER_VOTE_ACTION_ID,
        private_metadata: JSON.stringify( metadata ),
        title: {
            "type": "plain_text",
            "text": "🗳 Vote! 🗳",
            "emoji": true
        },
        "submit": {
            "type": "plain_text",
            "text": "Choose",
            "emoji": true
        },
        "close": {
            "type": "plain_text",
            "text": "Cancel",
            "emoji": true
        },
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

        const sections = TurnManager.getBigCardSections(card, i + 1)
        dialogue.blocks = dialogue.blocks.concat(sections);
        dialogue.blocks.push({ type: "divider" });
        options.push({
            text: {
                type: "plain_text",
                text: (i + 1).toString()
            },
            value: card.id.toString()
        });
    }

    // show menu
    dialogue.blocks.push({
        block_id: PLAYER_VOTE_BLOCK_ID,
        type: "input",
        label: {
            type: "plain_text",
            text: `🗳 Choose a card 🗳`,
            emoji: true
        },
        element:
        {
            type: "static_select",
            action_id: PLAYER_VOTE_BLOCK_ID + "_menu",
            options: options,
        }
    });

    return dialogue;
}

export function getPlayerVotePrompt(game: Game, mainPlayer: Player, player: Player) {
    return getPromptStartVoteMessage(game, player.id, mainPlayer.slack_user_id, game.currentkeyword, game.vote_end_time);
}

export async function promptPlayerVote(game: Game, mainPlayer: Player, player: Player) {
    const message = getPlayerVotePrompt(game, mainPlayer, player);
    await Slack.postEphemeralMessage(game.workspace_id, game.slackchannelid, player.slack_user_id, message);
}

export async function promptPlayerVotes(game: Game, mainPlayer: Player, players: Player[] ) {
    // for reach player show them a shuffled list of gifs
    for (const player of players) {
        await promptPlayerVote(game, mainPlayer, player);
    }
}

export async function handleOpenPlayerVoteDialogue(payload: Slack.ActionPayload, respond: (message: Slack.InteractiveMessageResponse) => void) {
    const metadata = JSON.parse( payload.actions[0].value ) as DialogueMetadata;
    console.log("Player is voting " + metadata.playerId);

    const game = await GameController.getGameForSlackChannel(payload.channel.id);
    if (game == undefined || game.currentturnidx != metadata.turnIdx)
        throw new Error("Unknown game or this button is from another turn");
    if ( !game.isreadytovote)
        throw new Error("Somehow you're voting too early");
    if (game.isvotingcomplete)
        throw new Error("Voting already complete, you were too slow :-(");
    
    const allPlayers = await PlayerController.getPlayersForGame(game.id);
    const player = await allPlayers.find(p => p.id == metadata.playerId);
    if (player == undefined || player.chosen_gif_id == undefined) {
        respond({ response_type: "ephemeral", replace_original: false, text: "Are you in this round?" });
        return;
    }
    if (player.id == game.currentplayerturn ) {
        respond({ response_type: "ephemeral", replace_original: false, text: "You can't vote!" });
        return;
    }
    if (player.voted_gif_id != undefined ) {
        respond({ response_type: "ephemeral", replace_original: false, text: "You've already voted!" });
        return;
    }

    const otherPlayersWithGifs = allPlayers.filter(p => p.id != player.id && p.chosen_gif_id != undefined);
    const gifs = (await GifController.getCards(otherPlayersWithGifs.map(p => p.chosen_gif_id))).sort((a, b) => a.id - b.id);
    const mainplayer = allPlayers.find(p => p.id == game.currentplayerturn);

    const modal = getVoteDialogue(gifs, game.currentkeyword, mainplayer.slack_user_id, game.id, player.id, game.currentturnidx);
    try {
        await Slack.showModal(game.workspace_id, payload.trigger_id, modal);
    }
    catch( error ) {
        respond({ response_type: "ephemeral", replace_original: false, text: "Something went wrong with Slack. Try again? " + error } );
    }

    // TODO delete message if modal is cancelled
    // respond({ delete_original: true });
}

export async function handlePlayerVote(payload: Slack.ViewSubmissionPayload): Promise<Slack.InteractiveViewResponse> {
    const voteMetadata = JSON.parse(payload.view.private_metadata) as DialogueMetadata;

    const game = await GameController.getGameForId(voteMetadata.gameId);
    if (game == undefined|| game.currentturnidx != voteMetadata.turnIdx)
        throw new Error("Unknown game");
    if ( !game.isreadytovote)
        throw new Error("Somehow you're voting too early");
    if (game.isvotingcomplete)
        throw new Error("Voting already complete, you were too slow :-(");
    if (voteMetadata.playerId == game.currentplayerturn)
        throw new Error("The main player but tried to vote");
    
    const chosenCardId = +payload.view.state.values[PLAYER_VOTE_BLOCK_ID][PLAYER_VOTE_BLOCK_ID+"_menu"].selected_option.value
    
    await TurnManager.playerVote(game.id, voteMetadata.playerId, chosenCardId);
    
    return undefined;
}