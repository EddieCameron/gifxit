import * as DB from "./server"
import Game from "./models/game";
import * as PlayerController from "./playercontroller";
import Player from "./models/player";

const games: { [id: number]: Game } = {}

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

export async function createGame(channel: string) {
    const game = (await DB.query<Game>("INSERT INTO games(slackchannelid) VALUES($1) RETURNING *", channel))[0];
    games[game.id] = game;
    return game;
}

export async function startNextTurn(gameId: number) {
    // pick next player
    const [players, game] = await Promise.all([
        PlayerController.getPlayersForGame(gameId),
        getGameForId(gameId)
    ]);
    
    players.sort((a: Player, b: Player) => a.id - b.id);

    let nextPlayerIdx = -1;
    for (const player of players) {
        if (player.id > game.currentplayerturn) {
            nextPlayerIdx = player.id;
            break;
        }
    }

    if (nextPlayerIdx == -1) {
        // ran out of players, go back to start
        nextPlayerIdx = players[0].id
    }
    game.currentplayerturn = nextPlayerIdx;

    // increment turn idx
    game.currentturnidx++;
    
    // reset keyword
    game.currentkeyword = undefined;
    game.isreadytovote = false;

    games[game.id] = game;

    await DB.queryNoReturn(
        "UPDATE games SET currentplayerturn = $1, currentturnidx = $2, currentkeyword = $3, isreadytovote = $4 WHERE id=$5",
        nextPlayerIdx, game.currentturnidx, game.currentkeyword, game.isreadytovote, game.id);

    return game;
}

export async function setKeyword(gameId: number, keyword: string) {
    const game = await getGameForId(gameId);
    if (keyword.length > 500)
        keyword = keyword.slice(0, 500);
    
    game.currentkeyword = keyword;
    games[game.id] = game;
    await DB.queryNoReturn(
        "UPDATE games SET currentkeyword = $1 WHERE id=$2",
        keyword, game.id);
    return game;
}

export async function startVote(gameId: number) {
    const game = await getGameForId(gameId);
    
    game.isreadytovote = true;
    games[game.id] = game;
    await DB.queryNoReturn(
        "UPDATE games SET isreadytovote = $1 WHERE id=$2",
        true, game.id);
    return game;
}