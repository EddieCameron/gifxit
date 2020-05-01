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

const HAND_SIZE = 5;

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

function getCardHandMessage(cards: Gif[]): Slack.Message {
    const message: Slack.Message = {
        text: "Your cards",
        blocks: [
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `🃏Here are your ${cards.length} gifs🃏`
                }
            },
            {
                type: "context",
                elements: [
                    {
                        type: "mrkdwn",
                        text: "(keep them secret🤫)"
                    }
                ]
            }
        ]
    }

    let cardNumber = 1;
    for (const card of cards) {
        message.blocks.push(getBigCardSection(card, cardNumber));
        cardNumber++;
    }

    return message;
}

function getMainPlayerChoseMessage(mainPlayerSlackId: string, keyword: string): Slack.Message {
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
                type: "context",
                elements: [
                    {
                        type: "mrkdwn",
                        text: "(Check your DMs to continue)"
                    }
                ]
            }
        ]
    }
}

function getOtherPlayerChoseMessage(chosenPlayerSlackId: string, remainingPlayerSlackIds: string[]): Slack.Message {
    const remainingPlayerFields: MrkdwnElement[] = remainingPlayerSlackIds.map(p => {
        return {
            type: "mrkdwn",
            text: `<@${p}>`
        }
    });

    return {
        text: `<@${chosenPlayerSlackId}> has picked their card`,
        blocks: [
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `<@${chosenPlayerSlackId}> has picked their card`
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
        message.blocks.push(getBigCardSection(card, cardNumber));
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

function getPlayerVotedMessage(votedPlayerSlackId: string, remainingPlayerSlackIds: string[]): Slack.Message {
    const remainingPlayerFields: MrkdwnElement[] = remainingPlayerSlackIds.map(p => {
        return {
            type: "mrkdwn",
            text: `<@${p}>`
        }
    });

    return {
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

async function dealCards(gameid: number, playerid: number) {
    console.log( `Dealing cards to ${playerid}` )
    const playercards = await GifController.getPlayerCards(gameid, playerid)

    const cardsToDeal = HAND_SIZE - playercards.length;
    console.log( `Dealing ${cardsToDeal} cards to ${playerid}` )

    if (cardsToDeal <= 0)
        return;
    
    await GifController.dealCardsToPlayer(gameid, playerid, cardsToDeal);

    const allcards = await GifController.getPlayerCards(gameid, playerid);
    const player = await PlayerController.getPlayerWithId(playerid);

    const message = getCardHandMessage(allcards);
    return Slack.sendPm(player.slack_user_id, message);
}

export async function startNextTurn( gameId: number ) {
    const game = await GameController.startNextTurn(gameId);

    // draw cards
    const allPlayers = await PlayerController.resetPlayersForNewTurn(gameId);
    for (const player of allPlayers) {
        await dealCards(gameId, player.id);
    }

    // go to next player
    const nextplayer = await PlayerController.getPlayerWithId(game.currentplayerturn);
    await Slack.postMessage( game.slackchannelid, { text: `It's <@${nextplayer.slack_user_id}>'s turn!` })

    // prompt main player
    return PlayerChoose.promptMainPlayerTurn(nextplayer.slack_user_id, game.id, nextplayer.id, game.currentturnidx);
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

    return startNextTurn(game.id);
}

export async function mainPlayerChoose(gameid: number, playerId: number, cardId: number, keyword: string) {
    await PlayerController.setChosenGif(playerId, cardId);
    const game = await GameController.setKeyword(gameid, keyword);
    const player = await PlayerController.getPlayerWithId(playerId);

    // TODO confirmation or something
    const notifyEveryoneMessage = getMainPlayerChoseMessage(player.slack_user_id, keyword);
    await Slack.postMessage(game.slackchannelid, notifyEveryoneMessage);

    // get players to choose their own
    const allplayers = await PlayerController.getPlayersForGame(game.id);
    const otherplayers = allplayers.filter(p => p.id != player.id);
    return PlayerChoose.promptOtherPlayersTurns(otherplayers, player.slack_user_id, keyword, gameid, game.currentturnidx);
}

export async function otherPlayerChoose(gameid: number, playerId: number, cardId: number) {
    const game = await GameController.getGameForId(gameid);
    const chosenPlayer = await PlayerController.getPlayerWithId(playerId);
    const remainingPlayers = await PlayerController.setChosenGif(playerId, cardId);

    if (remainingPlayers.length == 0) {
        // all players chosen. Resolve turn!
        const allplayers = await PlayerController.getPlayersForGame(game.id);
        const allGifs = await GifController.getCards(allplayers.map(p => p.chosen_gif_id));
        await Slack.postMessage(game.slackchannelid, getPlayersReadyToVoteMessage(allGifs, game.currentkeyword));
        await PlayerVotes.promptPlayerVotes(game, allplayers, allGifs);
    }
    else {
        // tell everyone that choice was made, show remainign players
        const notifyChoiceMessage = getOtherPlayerChoseMessage(chosenPlayer.slack_user_id, remainingPlayers.map(p => p.slack_user_id));
        await Slack.postMessage(game.slackchannelid, notifyChoiceMessage);
    }
}

export async function playerVote(gameId: number, playerId: number, gifId: number) {
    const game = await GameController.getGameForId(gameId);
    console.log(game.id);
    const chosenPlayer = await PlayerController.getPlayerWithId(playerId);
    console.log(chosenPlayer.id);
    
    let remainingPlayers = await PlayerController.voteForGif(playerId, gifId);
    remainingPlayers = remainingPlayers.filter(p => p.id != game.currentplayerturn);

    console.log("Player " + chosenPlayer.id + " voted for " + gifId);

    if (remainingPlayers.length == 0) {
        // only the first player is left
        // resolve! get those votes
        const votes = await PlayerController.getAllVotes(game.id);
        return scoreVotes(game, votes);
    }
    else {
        // tell everyone that choice was made, show remainign players
        const notifyChoiceMessage = getPlayerVotedMessage(chosenPlayer.slack_user_id, remainingPlayers.map(p => p.slack_user_id));
        await Slack.postMessage(game.slackchannelid, notifyChoiceMessage);
    }
}

export async function startGame(gameid: number) {
    // set up player order TODO just use join order for now
    return startNextTurn(gameid);
}

/// debug
export async function debugScoreTurn(game: Game) {
    if (game == undefined)
        return;
    
    const votes = await PlayerController.getAllVotes(game.id);
    scoreVotes(game, votes);
}