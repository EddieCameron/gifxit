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

export function getMainPlayerChoseMessage(mainPlayerSlackId: string, keyword: string, gameTurnIdx: number): Slack.Message {
    return {
        text: `<@${mainPlayerSlackId}> has picked their card`,
        blocks: [
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `🛎 <@${mainPlayerSlackId}> has chosen a GIF! 🛎`
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
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `Pick a reaction GIF for their message`
                },
                accessory: {
                    type: "button",
                    text: {
                        type: "plain_text",
                        text: "Pick a GIF"
                    },
                    style: "primary",
                    value: gameTurnIdx.toString(),
                    action_id: PlayerChoose.START_OTHER_PLAYER_CHOOSE_ACTION_ID
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

export const SKIP_CHOOSE_ACTION = "skip_choose_callback";
function getSkipChooseBlock( gameTurnIdx: number ) {
    return {
        type: "section",
        text: {
            type: "mrkdwn",
            text: `or...skip 'em and move on to voting`
        },
        accessory: {
            type: "button",
            text: {
                type: "plain_text",
                text: "Skip"
            },
            style: "danger",
            value: gameTurnIdx.toString(),
            action_id: SKIP_CHOOSE_ACTION
        }
    }
}

function getPlayerChooseSummaryMessage( turnIdx: number, remainingPlayers: Player[]) {
    const message: Slack.Message = {
        text: `Waiting on players to choose their GIFs`,
        blocks: [
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `Still waiting on some players to choose their GIFs`
                }
            },
        ]
    }
    message.blocks = message.blocks.concat(getRemainingPlayersBlocks(remainingPlayers));
    message.blocks.push(getSkipChooseBlock(turnIdx));

    return message;
}

function getOtherPlayerChoseMessage(chosenPlayerSlackId: string, remainingPlayers: Player[], gameTurnIdx: number): Slack.Message {
    const message = {
        text: `<@${chosenPlayerSlackId}> has picked their GIF`,
        blocks: [
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `<@${chosenPlayerSlackId}> has picked their GIF`
                }
            },
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `Still waiting on`
                },
            }
        ]
    }

    message.blocks = message.blocks.concat(getRemainingPlayersBlocks(remainingPlayers));
    message.blocks.push(getSkipChooseBlock(gameTurnIdx));
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

    message.blocks.push({
        type: "section",
        text: {
            type: "mrkdwn",
            text: `Sending voting cards out...`
        }
    })
    return message
}

function getPlayerVotedMessage(votedPlayerSlackId: string, remainingPlayers: Player[]): Slack.Message {
    const remainingPlayerFields: MrkdwnElement[] = remainingPlayers.map(p => {
        return {
            type: "mrkdwn",
            text: `<@${p.slack_user_id}>`
        }
    });
    const message: Slack.Message = {
        text: `<@${votedPlayerSlackId}> has voted`,
        blocks: [
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `<@${votedPlayerSlackId}> has voted`
                }
            },
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `Still waiting on`
                },
                fields: remainingPlayerFields
            }
        ]
    }
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
            voteText += `✅`;
        
        voteText += `\nVotes: `;
        for (const player of gifVote.votes) {
            voteText += ` <@${player.slack_user_id}>`
        }

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
            for (const vote of gifVote.votes) {
                voteText += `<@${vote.slack_user_id}> `
            }
            voteText += ` were fooled! <@${gifVote.chosenByPlayer.slack_user_id}> gets ${getEmojiForNumber(numVotes)} points`
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
function getNextTurnPrompt(currentTurnIdx: number): Slack.SlashResponse {
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

export async function startNextTurn( gameId: number ) {
    const game = await GameController.startNextTurn(gameId);

    // draw cards
    const allPlayers = await PlayerController.resetPlayersForNewTurn(gameId);
    for (const player of allPlayers) {
        await GifController.dealCardsToPlayer(game.id, player.id);
    }

    // go to next player
    const nextplayer = await PlayerController.getPlayerWithId(game.currentplayerturn);
    await Slack.postMessage( game.slackchannelid, { text: `It's <@${nextplayer.slack_user_id}>'s turn!` })

    // prompt main player
    return PlayerChoose.promptMainPlayerTurn(nextplayer.slack_user_id, game, nextplayer.id, game.currentturnidx);
}

async function showScoreSummary(game: Game) {
    const players = await PlayerController.getPlayersForGame(game.id);
    const message = getScoreSummaryMessage(players);
    return Slack.postMessage(game.slackchannelid, message);
}

async function scoreVotes(game: Game, gifVotes: GifVote[]) {
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

    await showScoreSummary(game);

    await Slack.postMessage( game.slackchannelid, getNextTurnPrompt(game.currentturnidx ) );
}

export async function mainPlayerChoose(gameid: number, playerId: number, cardId: number, keyword: string) {
    await PlayerController.setChosenGif(playerId, cardId, gameid);
    const game = await GameController.setKeyword(gameid, keyword);
    const player = await PlayerController.getPlayerWithId(playerId);

    // TODO confirmation or something
    const notifyEveryoneMessage = getMainPlayerChoseMessage(player.slack_user_id, keyword, game.currentturnidx);
    return await Slack.postMessage(game.slackchannelid, notifyEveryoneMessage);
}

export async function startVoting(game: Game) {
    // all players chosen. Resolve turn!
    const allPlayers = await PlayerController.getPlayersForGame(game.id);
    const chosenPlayers = allPlayers.filter(p => p.chosen_gif_id != undefined);
    const chosenGifs = PlayerVotes.shuffle(await GifController.getCards(chosenPlayers.map(p => p.chosen_gif_id)));
    await GameController.startVote(game.id);

    await Slack.postMessage(game.slackchannelid, getPlayersReadyToVoteMessage( chosenGifs, game.currentkeyword));

    const mainPlayer = allPlayers.find(p => p.id == game.currentplayerturn);
    const votingPlayers = chosenPlayers.filter(p => p.id != game.currentplayerturn);
    await PlayerVotes.promptPlayerVotes(game, mainPlayer, votingPlayers);
    
}

export async function getOtherPlayersChooseSummary( game: Game, ) {
    // tell everyone that choice was made, show remainign players
    const allplayers = await PlayerController.getPlayersForGame(game.id);
    const playersToChoose = allplayers.filter(p => p.chosen_gif_id == undefined);
    return getPlayerChooseSummaryMessage(game.currentturnidx, playersToChoose);
}

export async function otherPlayerChoose(gameid: number, playerId: number, cardId: number) {
    const game = await GameController.getGameForId(gameid);
    const chosenPlayer = await PlayerController.getPlayerWithId(playerId);
    const remainingPlayers = await PlayerController.setChosenGif(playerId, cardId, gameid);

    if (remainingPlayers.length == 0) {
        await startVoting(game);
    }
    else {
        // tell everyone that choice was made, show remainign players
        const notifyChoiceMessage = getOtherPlayerChoseMessage(chosenPlayer.slack_user_id, remainingPlayers, game.currentturnidx);
        await Slack.postMessage(game.slackchannelid, notifyChoiceMessage);
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
        const votes = await PlayerController.getAllVotes(game.id);
        return scoreVotes(game, votes);
    }
    else {
        // tell everyone that choice was made, show remainign players
        const notifyChoiceMessage = getPlayerVotedMessage(chosenPlayer.slack_user_id, remainingPlayers);
        await Slack.postMessage(game.slackchannelid, notifyChoiceMessage);
    }
}

export async function startGame(gameid: number) {
    // set up player order TODO just use join order for now
    return startNextTurn(gameid);
}

/// debug 
export async function debugRestartTurn(game: Game) {
    startNextTurn(game.id);
}

export async function debugScoreTurn(game: Game) {
    if (game == undefined)
        return;
    
    const votes = await PlayerController.getAllVotes(game.id);
    scoreVotes(game, votes);
}