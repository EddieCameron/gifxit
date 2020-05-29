import Game from './models/game'
import * as DB from '../server'
import GameTurn from './models/gameturn';
import GameGif from './models/gamegif';
import { chooseGifsForTurn } from './gifcontroller';
import { createPlayer } from './playercontroller';
import { PoolClient } from 'pg';

export async function getGameForId(id: number) {
    return (await DB.query<Game>(null, "SELECT * FROM codegames WHERE id=$1", id))[0];
}

export async function getTurnForId(id: number) {
    return (await DB.query<GameTurn>(null, "SELECT * FROM codegameturns WHERE id=$1", id))[0];
}

export async function getGameForSlackChannel(channel: string) {
    const matchingGames = await DB.query<Game>(null, "SELECT * FROM codegames WHERE slack_channel_id=$1", channel)
    if (matchingGames.length == 0)
        return undefined;
    
    return matchingGames[0];
}

export async function createGame(workspace: string, channel: string, startplayerslackid: string) {
    let game: Game;
    await DB.transactionCallback(async client => {
        game = (await DB.query<Game>(client, "INSERT INTO codegames(workspace_id, slack_channel_id) VALUES($1, $2) RETURNING *", workspace, channel))[0];
        await createPlayer(client, startplayerslackid, game.id);
    });
    return game;
}

export async function createTurn(game: number, player: number) {
    let turn: GameTurn;
    let gameGifs: GameGif[];
    await DB.transactionCallback(async client => {
        turn = (await DB.query<GameTurn>(client, "INSERT INTO codegameturns(game_id, player_id) VALUES($1, $2) RETURNING *",
            game, player))[0];
        await DB.queryNoReturn(client, "UPDATE codegames SET current_turn_id = $2 WHERE id = $1", game, turn.id);

        gameGifs = await chooseGifsForTurn(client, turn.id, 12, 4);
    });
    return { turn: turn, gifs: gameGifs };
}

export async function setKeyword(turn: GameTurn, keyword: string) {
    if (keyword.length > 500)
        keyword = keyword.slice(0, 500);
    
    turn.current_keyword = keyword;
    await DB.queryNoReturn( null,
        "UPDATE codegameturns SET current_keyword = $2 WHERE id=$1",
        turn.id, keyword);
    return turn;
}

export async function lockInGif(client: PoolClient, turn: GameTurn, gifid: number) {
    if (!turn.chosen_a_gif_id) {
        turn.chosen_a_gif_id = gifid;
        await DB.queryNoReturn( client,
            "UPDATE codegameturns SET chosen_a_gif_id = $2 WHERE id=$1",
            turn.id, gifid);
    }
    else if (!turn.chosen_b_gif_id) {
        turn.chosen_b_gif_id = gifid;
        await DB.queryNoReturn( client,
            "UPDATE codegameturns SET chosen_b_gif_id = $2 WHERE id=$1",
            turn.id, gifid);
    }
    else if (!turn.chosen_c_gif_id) {
        turn.chosen_c_gif_id = gifid;
        await DB.queryNoReturn( client,
            "UPDATE codegameturns SET chosen_c_gif_id = $2 WHERE id=$1",
            turn.id, gifid);
    }
    else if (!turn.chosen_d_gif_id) {
        turn.chosen_d_gif_id = gifid;
        await DB.queryNoReturn( client,
            "UPDATE codegameturns SET chosen_d_gif_id = $2 WHERE id=$1",
            turn.id, gifid);
    }
    else {
        throw Error("Already locked in all thse gifs");
    }
    return turn;
}