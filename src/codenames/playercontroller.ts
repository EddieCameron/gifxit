import Player from './models/player';
import * as DB from "../server"
import { PoolClient } from 'pg';

export async function getPlayersForGame(id: number) {
    console.log("Getting players for game " + id);
    return await DB.query<Player>(null,"SELECT * FROM codeplayers WHERE game_id=$1", id);
}

export async function getPlayerWithId(playerid: number) {
    return ( await DB.query<Player>(null, "SELECT * FROM codeplayers WHERE id=$1", playerid))[0];
}

export async function createPlayer(client: PoolClient, slack_id: string, game_id: number) {
    console.log("creating player" ); 
    return (await DB.query<Player>(client, "INSERT INTO codeplayers(slack_user_id, game_id) VALUES($1, $2) RETURNING *", slack_id, game_id))[0];
}

export async function getOrCreatePlayerWithSlackId(slack_id: string, gameId: number) {
    let player: Player;
    await DB.transactionCallback(async client => {
        const playerMatches = await DB.query<Player>(client, "SELECT * FROM codeplayers WHERE slack_user_id=$1 AND game_id=$2", slack_id, gameId);
        if (playerMatches.length == 0) {
            player = await createPlayer(client, slack_id, gameId);
        }
        else {
            player = playerMatches[0];
        }
    });

    return player;
}