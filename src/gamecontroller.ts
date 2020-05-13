import * as DB from "./server"
import Game from "./models/game";
import * as PlayerController from "./playercontroller";
import Player from "./models/player";

const games: { [id: number]: Game } = {}

const choosePhaseLengthMs = 1000 * 60 * 10;
const votePhaseLengthMs = 1000 * 60 * 10;

export async function getGameForId(id: number) {
    if (games[id] != undefined)
        return games[id];
    
    const matchingGames = await DB.query<Game>("SELECT * FROM games WHERE id=$1", id);
    if (matchingGames.length == 0)
        return undefined;
    
    games[id] = matchingGames[0];
    return matchingGames[0];
}

export async function getGameForSlackChannel(channel: string) {
    for (const id in games) {
        if (Object.prototype.hasOwnProperty.call(games, id)) {
            const game = games[id];
            if (game.slackchannelid == channel)
                return game;
        }
    }

    const matchingGames = await DB.query<Game>("SELECT * FROM games WHERE slackchannelid=$1", channel)
    console.log( matchingGames.length )
    if (matchingGames.length == 0)
        return undefined;
    
    const game = matchingGames[0];
    games[game.id] = game;
    return game;
}

export async function createGame(workspace: string, channel: string) {
    const game = (await DB.query<Game>("INSERT INTO games(workspace_id, slackchannelid) VALUES($1, $2) RETURNING *", workspace, channel))[0];
    games[game.id] = game;
    return game;
}

export async function pickNextPlayerTurn(game: Game) {
    // pick next player
    const players = await PlayerController.getPlayersForGame(game.id);
        
    players.sort((a: Player, b: Player) => a.id - b.id);
    
    for (const player of players) {
        if (player.id > game.currentplayerturn) {
            return player;
        }
    }
    
    return players[0];  // start again
}

export async function startNextTurn(game: Game, player: Player) {
    game.currentplayerturn = player.id;

    // increment turn idx
    game.currentturnidx++;
    
    // reset keyword
    game.currentkeyword = undefined;
    game.isreadytovote = false;
    game.isvotingcomplete = false;

    games[game.id] = game;

    await DB.queryNoReturn(
        "UPDATE games SET currentplayerturn = $1, currentturnidx = $2, currentkeyword = $3, isreadytovote = $4, isvotingcomplete = $5 WHERE id=$6",
        player.id, game.currentturnidx, game.currentkeyword, game.isreadytovote, game.isvotingcomplete, game.id);

    return game;
}

export async function setKeyword(gameId: number, keyword: string) {
    const game = await getGameForId(gameId);
    if (keyword.length > 500)
        keyword = keyword.slice(0, 500);
    
    const endTime = new Date(Date.now() + choosePhaseLengthMs);
    
    game.currentkeyword = keyword;
    game.choose_end_time = endTime;
    games[game.id] = game;
    await DB.queryNoReturn(
        "UPDATE games SET currentkeyword = $1, choose_end_time = $2 WHERE id=$3",
        keyword, endTime, game.id);
    return game;
}

export async function startVote(gameId: number) {
    const game = await getGameForId(gameId);
    
    const endTime = new Date(Date.now() + votePhaseLengthMs);
    
    game.isreadytovote = true;
    game.vote_end_time = endTime;
    games[game.id] = game;
    await DB.queryNoReturn(
        "UPDATE games SET isreadytovote = $1, vote_end_time = $2 WHERE id=$3",
        true, endTime, game.id);
    return game;
}

export async function setChooseSummaryMessage(gameId: number, messagets: string) {
    const game = await getGameForId(gameId);
    
    game.lastchosesummarymessage = messagets;
    games[game.id] = game;
    await DB.queryNoReturn(
        "UPDATE games SET lastchosesummarymessage = $1 WHERE id=$2",
        messagets, game.id);
    return game;
}

export async function setVoteSummaryMessage(gameId: number, messagets: string) {
    const game = await getGameForId(gameId);
    
    game.lastvotesummarymessage = messagets;
    games[game.id] = game;
    await DB.queryNoReturn(
        "UPDATE games SET lastvotesummarymessage = $1 WHERE id=$2",
        messagets, game.id);
    return game;
}

export async function completeVote(gameId: number) {
    const game = await getGameForId(gameId);
    
    game.isvotingcomplete = true;
    games[game.id] = game;
    await DB.queryNoReturn(
        "UPDATE games SET isvotingcomplete = $1 WHERE id=$2",
        true, game.id);
    return game;
}