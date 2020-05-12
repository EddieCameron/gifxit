import * as GifController from "./gifcontroller"
import * as GameController from "./gamecontroller"
import * as PlayerController from "./playercontroller"
import * as PlayerChoose from "./playerchoose"
import * as PlayerVotes from "./playervotes"
import * as Slack from "./slack"
import Gif from "./models/gif";
import { MrkdwnElement, ImageBlock, SectionBlock } from "@slack/web-api"
import GifVote from "./models/gifvotes"
import Game from "./models/game"
import Player from "./models/player"
import { DialogueMetadata } from "./gamemanager"
import { addTimer, addTimerDueDate } from "./steadytimer/steadytimer"

export function getEmojiForNumber(num: number) {
    switch (num) {
        case 0:
            return "0️⃣";
        case 1:
            return "1️⃣"
        case 2:
            return "2️⃣"
        case 3:
            return "3️⃣"
        case 4:
            return "4️⃣"
        case 5:
            return "5️⃣"
        case 6:
            return "6️⃣"
        case 7:
            return "7️⃣"
        case 8:
            return "8️⃣"
        case 9:
            return "9️⃣"
    
        default:
            "";
    }
}

export function getTextList(listItems: string[]) {
    let message = "";
    for (let index = 0; index < listItems.length; index++) {
        const item = listItems[index];

        if (index > 0) {
            if (index >= listItems.length - 1)
                message += " and ";
            else
                message += ", ";
        }
        message += item;
    }
    return message;
}

export function getSmallCardSection(card: Gif, handNumber: number) {
    return {
        "type": "section",
        "text": {
            "type": "mrkdwn",
            "text": getEmojiForNumber(handNumber)
        },
        "accessory": {
            "type": "image",
            "image_url": card.url,
            "alt_text": "GIF " + handNumber.toString()
        }
    } as SectionBlock;
}

export function getBigCardSection(card: Gif, handNumber: number) {
    return {
        type: "image",
        title: {
            type: "plain_text",
            text: getEmojiForNumber(handNumber),
            emoji: true
        },
        image_url: card.url,
        alt_text: "GIF " + handNumber.toString()
    } as ImageBlock;
}

function getTurnStartMessage(mainPlayerSlackId: string, game: Game) {
    const metadata: DialogueMetadata = {
        gameId: game.id,
        playerId: game.currentplayerturn,
        turnIdx: game.currentturnidx,
    }

    return {
        text: `It's <@${mainPlayerSlackId}>'s turn!`,
        blocks: [
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `It's <@${mainPlayerSlackId}>'s turn!`,
                }
            },
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `...or...skip 'em if they can't play right now`,
                },
                accessory: {
                    type: "button",
                    text: {
                        type: "plain_text",
                        text: "Skip their turn"
                    },
                    style: "danger",
                    value: JSON.stringify(metadata),
                    action_id: PlayerChoose.MAIN_PLAYER_PASS_ACTION_ID
                }
            } 
        ]
    }
}

export const REMIND_CHOOSE_ACTION = "remind_player_choose";
function getRemainingPlayersBlocks(remainingPlayers: Player[]) {
    const blocks = []   
    for (const player of remainingPlayers) {
        blocks.push({
            type: "section",
            text: {
                type: "mrkdwn",
                text: `<@${player.slack_user_id}>`
            },
            accessory: {
                type: "button",
                text: {
                    type: "plain_text",
                    text: "Remind them 👈",
                    emoji: true,
                },
                action_id: REMIND_CHOOSE_ACTION,
                value: player.id.toString()
            }
        } )
    }
    return blocks;
}

export const SKIP_ACTION = "skip_choose_callback";
function getSkipVoteBlock( gameTurnIdx: number ) {
    return {
        type: "section",
        text: {
            type: "mrkdwn",
            text: `or...skip 'em and move on to scoring`
        },
        accessory: {
            type: "button",
            text: {
                type: "plain_text",
                text: "Skip"
            },
            style: "danger",
            value: gameTurnIdx.toString(),
            action_id: SKIP_ACTION
        }
    }
}

export function getPlayerChooseSummaryMessage(turnIdx: number, mainPlayerSlackId: string, keyword: string, chosenPlayers: Player[], showStartVoteButton: boolean, endChooseTime: Date ) {
    const message: Slack.Message = {
        text: 'Choose your GIFs',
        blocks: [
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `🛎 <!here> New Round! 🛎`
                }
            },
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `<@${mainPlayerSlackId}> has chosen a GIF!`
                }
            },
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `Their message is *${keyword}*`
                }
            },
            {
                type: "divider"
            },
        ]
    }

    if (chosenPlayers.length > 0) {
        const chosenMessage = `${getTextList(chosenPlayers.map(p => `<@${p.slack_user_id}>`))} ${chosenPlayers.length == 1 ? "has" : "have"} picked a GIF`
        message.blocks.push({
            type: "section",
            text: {
                type: "mrkdwn",
                text: chosenMessage
            }
        });
    }

    // show remaining players
    // if (remainingPlayers.length > 0) {
    //     message.blocks.push(
    //         {
    //             type: "section",
    //             text: {
    //                 type: "mrkdwn",
    //                 text: `Now these players need to pick a GIF that could also match that message`
    //             }
    //         });

    //     message.blocks = message.blocks.concat(getRemainingPlayersBlocks(remainingPlayers));
    //     message.blocks.push({ type: "divider" });
    // }

        message.blocks.push(
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `You have until <!date^${endChooseTime.getTime()/1000|0}^{time}|${endChooseTime.toTimeString()}> to pick a reaction GIF for their message`
                },
                accessory: {
                    type: "button",
                    text: {
                        type: "plain_text",
                        text: "Pick a GIF"
                    },
                    style: "primary",
                    value: turnIdx.toString(),
                    action_id: PlayerChoose.START_OTHER_PLAYER_CHOOSE_ACTION_ID
                }
            });
    
    if (showStartVoteButton) {
        message.blocks.push({
            type: "section",
            text: {
                type: "mrkdwn",
                text: `Enough players have picked *${keyword}* GIFs. Wait for more or click to move on to voting`
            },
            accessory: {
                type: "button",
                text: {
                    type: "plain_text",
                    text: "VOTE!"
                },
                style: "danger",
                value: turnIdx.toString(),
                action_id: SKIP_ACTION
            }
        });
    }
    else {
        message.blocks.push(
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `Need at least 2 players to pick *${keyword}* GIFs before we can vote`
                },
            });
    }

    return message;
}

function getPlayersReadyToVoteMessage(cards: Gif[], keyword: string): Slack.Message {
    const message: Slack.Message = {
        text: `"Everyone has chosen a GIF. Sending voting cards out...`,
        blocks: [
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `Here are what GIFs you think match *${keyword}*`
                }
            },
        ]
    }

    let cardNumber = 1;
    for (const card of cards) {
        message.blocks.push(getSmallCardSection(card, cardNumber));
        cardNumber++;
    }
    return message
}

function getVoteSummaryMessage( turnIdx: number, mainplayerslackid: string, votedPlayers: Player[], remainingPlayers: Player[]) {
    const message: Slack.Message = {
        text: `Waiting on players to vote`,
        blocks: [
        ]
    }

    if (votedPlayers.length > 0) {
        const votedmessage = `🗳 ${getTextList(votedPlayers.map(p => `<@${p.slack_user_id}>`))} ${votedPlayers.length == 1 ? "has" : "have"} voted 🗳`
        message.blocks.push({
            type: "section",
            text: {
                type: "mrkdwn",
                text: votedmessage
            }
        });
        message.blocks.push({ type: "divider" });
    }

    if (remainingPlayers.length > 0) {
        message.blocks.push(
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `Now these players need to vote for which GIF they think was chosen by <@${mainplayerslackid}>`
                }
            });

        message.blocks = message.blocks.concat(getRemainingPlayersBlocks(remainingPlayers));
        message.blocks.push({ type: "divider" });
    }

    message.blocks.push(getSkipVoteBlock(turnIdx));

    return message;
}

function getVotesAreInMessage(gifVotes: GifVote[], mainPlayerId: number ): Slack.Message {
    const message: Slack.Message = {
        text: `🗳 The votes are in...`,
        blocks: [
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `🗳 The votes are in...`
                }
            },
        ]
    }

    gifVotes = gifVotes.sort((v1, v2) => v2.votes.length - v1.votes.length);
    for (const gifVote of gifVotes) {
        const voteSection = getSmallCardSection(gifVote.gif, gifVote.votes.length);

        const isMainPlayerGif = gifVote.chosenByPlayer.id == mainPlayerId;
        let voteText = `Chosen by <@${gifVote.chosenByPlayer.slack_user_id}>`
        if (isMainPlayerGif)
            voteText = `✅ ${voteText} ✅`;
        
        voteText += `\nVotes: ${getTextList(gifVote.votes.map( p => `<@${p.slack_user_id}>`))}`

        const numVotes = gifVote.votes.length;
        if (isMainPlayerGif) {
            if (numVotes == 0) {
                voteText += `\n No one guessed <@${gifVote.chosenByPlayer.slack_user_id}>s gif! They get ${getEmojiForNumber(0)} points. Everyone else gets ${getEmojiForNumber(2)} points`;
            }
            else if (numVotes == gifVotes.length - 1) {
                voteText += `\n Everyone guessed <@${gifVote.chosenByPlayer.slack_user_id}>s gif! They get ${getEmojiForNumber(0)} points. Everyone else gets ${getEmojiForNumber(2)} points`;
            }
            else {
                voteText += `\n Everyone who voted right (+ <@${gifVote.chosenByPlayer.slack_user_id}>) gets ${getEmojiForNumber(3)} points each`;
            }
        }
        else if (numVotes > 0) {
            voteText += `\n`;
            voteText += `They got fooled! <@${gifVote.chosenByPlayer.slack_user_id}> gets ${getEmojiForNumber(numVotes)} points`
        }

        voteSection.text.text = voteText;
        message.blocks.push(voteSection)
    }
    return message
}

function getScoreSummaryMessage(players: Player[]) {
    const scoreFields: MrkdwnElement[] = players.map(p => {
        return {
            type: "mrkdwn",
            text: `<@${p.slack_user_id}> ${p.score}`
        };
    });

    return {
        text: `Scores`,
        blocks: [
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `Updated Scores`
                },
                fields: scoreFields
            },
        ]
    }
}

export const NEXT_TURN_CALLBACK = "start_next_turn";
export function getNextTurnPrompt(currentTurnIdx: number): Slack.SlashResponse {
    return {
        response_type: "ephemeral",
        text: "Are you ready to start the next turn?",
        blocks: [
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: "Are you ready to start the next turn?"
                }
            },
            {
                type: "actions",
                elements: [
                    {
                        action_id: NEXT_TURN_CALLBACK,
                        type: "button",
                        text: {
                            type: "plain_text",
                            text: "Next Turn"
                        },
                        style: "primary",
                        value: currentTurnIdx.toString()
                    }
                ]
            }
        ]
    }
}

const notEnoughPlayersMessage: Slack.Message = {
    text: `Not enough players 😅`,
    blocks: [
        {
            type: "section",
            text: {
                type: "mrkdwn",
                text: `Not enough players 😅`,
            }
        },
        {
            type: "image",
            image_url: `https://media.giphy.com/media/VfyC5j7sR4cso/giphy.gif`,
            alt_text: `:-(`

        }
    ]
}

async function showScoreSummary(game: Game, players: Player[] ) {
    const message = getScoreSummaryMessage(players);
    return Slack.postMessage(game.slackchannelid, message);
}

export async function scoreVotes(game: Game) {
    const gifVotes = await PlayerController.getAllVotes(game.id);
    await GameController.completeVote(game.id);

    const playerPoints: { [playerId: number]: number } = {}
    for (const gifVote of gifVotes) {
        playerPoints[gifVote.chosenByPlayer.id] = 0;
    }

    for (const gifVote of gifVotes) {
        const isMainPlayerGif = gifVote.chosenByPlayer.id == game.currentplayerturn;
        const numVotes = gifVote.votes.length;
        if (isMainPlayerGif) {
            if (numVotes > 0 && numVotes < gifVotes.length - 1) {
                // everyone who voted right + main player gets 3 points
                playerPoints[gifVote.chosenByPlayer.id] += 3;
                for (const vote of gifVote.votes) {
                    playerPoints[vote.id] += 3;
                }
            }
            else {
                // everyone except main player gets 2
                for (const v of gifVotes) {
                    if (v.chosenByPlayer.id != game.currentplayerturn) {
                        playerPoints[v.chosenByPlayer.id] += 2;
                    }
                }
            }
        }
        else if (numVotes > 0) {
            playerPoints[gifVote.chosenByPlayer.id] += numVotes
        }
    }

    // actually update
    for (const gifVote of gifVotes) {
        await PlayerController.addPoints(gifVote.chosenByPlayer.id, playerPoints[gifVote.chosenByPlayer.id]);
    }

    const voteSummaryMessage = getVotesAreInMessage(gifVotes, game.currentplayerturn);
    await Slack.postMessage(game.slackchannelid, voteSummaryMessage);

    // show updated scores for recent players
    await showScoreSummary(game, gifVotes.map(v => v.chosenByPlayer));

    await Slack.postMessage( game.slackchannelid, getNextTurnPrompt(game.currentturnidx ) );
}

export async function postNewChooseSummaryMessage(game: Game) {
    const allplayers = await PlayerController.getPlayersForGame(game.id);
    const mainplayer = allplayers.find(p => p.id == game.currentplayerturn);
    const pickedplayers = allplayers.filter(p => p.id != game.currentplayerturn && p.chosen_gif_id != undefined);

    const message = getPlayerChooseSummaryMessage(game.currentturnidx, mainplayer.slack_user_id, game.currentkeyword, pickedplayers, pickedplayers.length >= 2, game.choose_end_time);
    const post = await Slack.postMessage(game.slackchannelid, message);
    GameController.setChooseSummaryMessage(game.id, post.ts);
}

export async function updateChooseSummaryMessage(game: Game) {
    const allplayers = await PlayerController.getPlayersForGame(game.id);
    const mainplayer = allplayers.find(p => p.id == game.currentplayerturn);
    const pickedplayers = allplayers.filter(p => p.id != game.currentplayerturn && p.chosen_gif_id != undefined);

    const message = getPlayerChooseSummaryMessage(game.currentturnidx, mainplayer.slack_user_id, game.currentkeyword, pickedplayers, pickedplayers.length >= 2, game.choose_end_time);
    const post = await Slack.updateMessage(game.slackchannelid, game.lastchosesummarymessage, message);
    if (post.error) {
        // couldn't update, post as new
        const post = await Slack.postMessage(game.slackchannelid, message);
        GameController.setChooseSummaryMessage(game.id, post.ts);
    }
}

export async function postNewVoteSummaryMessage(game: Game) {
    const allplayers = await PlayerController.getPlayersForGame(game.id);
    const mainplayer = allplayers.find(p => p.id == game.currentplayerturn);
    const votedplayers = allplayers.filter(p => p.id != game.currentplayerturn && p.voted_gif_id != undefined);
    const remainingplayers = allplayers.filter(p => p.id != game.currentplayerturn && p.chosen_gif_id != undefined && p.voted_gif_id == undefined);

    const message = getVoteSummaryMessage(game.currentturnidx, mainplayer.slack_user_id, votedplayers, remainingplayers);
    const post = await Slack.postMessage(game.slackchannelid, message);
    GameController.setVoteSummaryMessage(game.id, post.ts);
}

export async function updateVoteSummaryMessage(game: Game) {
    const allplayers = await PlayerController.getPlayersForGame(game.id);
    const mainplayer = allplayers.find(p => p.id == game.currentplayerturn);
    const votedplayers = allplayers.filter(p => p.id != game.currentplayerturn && p.voted_gif_id != undefined);
    const remainingplayers = allplayers.filter(p => p.id != game.currentplayerturn && p.chosen_gif_id != undefined && p.voted_gif_id == undefined);

    const message = getVoteSummaryMessage(game.currentturnidx, mainplayer.slack_user_id, votedplayers, remainingplayers);
    const post = await Slack.updateMessage(game.slackchannelid, game.lastvotesummarymessage, message);
    if (post.error) {
        // couldn't update, post as new
        const post = await Slack.postMessage(game.slackchannelid, message);
        GameController.setVoteSummaryMessage(game.id, post.ts);
    }
}

export async function playerVote(gameId: number, playerId: number, gifId: number) {
    const game = await GameController.getGameForId(gameId);
    console.log(game.id);
    const chosenPlayer = await PlayerController.getPlayerWithId(playerId);
    console.log(chosenPlayer.id);

    let remainingPlayers = await PlayerController.voteForGif(playerId, gifId, gameId);
    remainingPlayers = remainingPlayers.filter(p => p.id != game.currentplayerturn && p.chosen_gif_id != undefined);

    console.log("Player " + chosenPlayer.id + " voted for " + gifId);

    if (remainingPlayers.length == 0) {
        // only the first player is left
        // resolve! get those votes
        return scoreVotes(game);
    }
    else {
        // tell everyone that choice was made, show remainign players
        updateVoteSummaryMessage(game);
    }
}

export async function startVoting(game: Game) {
    // all players chosen. Resolve turn!
    const allPlayers = await PlayerController.getPlayersForGame(game.id);
    const chosenPlayers = allPlayers.filter(p => p.chosen_gif_id != undefined);
    if (chosenPlayers.length < 3) {
        await Slack.postMessage(game.slackchannelid, notEnoughPlayersMessage );
        await Slack.postMessage(game.slackchannelid, getNextTurnPrompt(game.currentturnidx));
        return;
    }

    const chosenGifs = PlayerVotes.shuffle(await GifController.getCards(chosenPlayers.map(p => p.chosen_gif_id)));
    await GameController.startVote(game.id);

    await Slack.postMessage(game.slackchannelid, getPlayersReadyToVoteMessage( chosenGifs, game.currentkeyword));
    await postNewVoteSummaryMessage(game);

    const mainPlayer = allPlayers.find(p => p.id == game.currentplayerturn);
    const votingPlayers = chosenPlayers.filter(p => p.id != game.currentplayerturn);
    await PlayerVotes.promptPlayerVotes(game, mainPlayer, votingPlayers);
}

export async function otherPlayerChoose(game: Game, playerId: number, chosenGif: number) {
    await PlayerController.setChosenGif(playerId, chosenGif, game.id);
    
    return updateChooseSummaryMessage(game);
}

export async function mainPlayerChoose(gameid: number, playerId: number, cardId: number, keyword: string) {
    await PlayerController.setChosenGif(playerId, cardId, gameid);
    const game = await GameController.setKeyword(gameid, keyword);

    // TODO confirmation or something
    await postNewChooseSummaryMessage(game);

    const metadata: ChooseTimerMetadata = {
        gameId: gameid,
        turnIdx: game.currentturnidx
    }
    addTimerDueDate("chooseTimeUp", game.choose_end_time, JSON.stringify(metadata));

    //return PlayerChoose.promptPlayerChooses(game, playersToChoose.map(p => p.slack_user_id));
}

export async function startNextTurn( game: Game, player: Player ) {
    await GameController.startNextTurn(game, player);

    // draw cards
    const allPlayers = await PlayerController.resetPlayersForNewTurn(game.id);
    for (const player of allPlayers) {
        await GifController.dealCardsToPlayer(game.id, player.id);
    }

    // go to next player
    const nextplayer = await PlayerController.getPlayerWithId(game.currentplayerturn);
    const startTurnMessage = getTurnStartMessage(nextplayer.slack_user_id, game);
    await Slack.postMessage( game.slackchannelid, startTurnMessage )

    // prompt main player
    return PlayerChoose.promptMainPlayerTurn(nextplayer.slack_user_id, game, nextplayer.id, game.currentturnidx);
}

export async function startGame(game: Game) {
    // set up player order TODO just use join order for now
    const allplayers = await PlayerController.getPlayersForGame( game.id )
    startNextTurn(game, allplayers[Math.floor(Math.random() * allplayers.length)]);
}

// timers
interface ChooseTimerMetadata {
    gameId: number;
    turnIdx: number;
}
export async function handleChooseTimeUp(metadata: string) {
    const chooseMetadata = JSON.parse(metadata) as ChooseTimerMetadata;

    const game = await GameController.getGameForId(chooseMetadata.gameId);
    if (game == undefined || game.currentturnidx != chooseMetadata.turnIdx) {
        console.log("This game doesn't exit or this has already been skipped");
        return;
    }

    if (game.isreadytovote || game.isvotingcomplete) {
        console.log("already moved on to voting")
        return;
    }

    return startVoting(game);
}


/// debug 
export async function debugRestartTurn(game: Game) {
    const allplayers = await PlayerController.getPlayersForGame( game.id )
    startNextTurn(game, allplayers[Math.floor(Math.random() * allplayers.length)]);
}

export async function debugScoreTurn(game: Game) {
    if (game == undefined)
        return;
    
    scoreVotes(game);
}