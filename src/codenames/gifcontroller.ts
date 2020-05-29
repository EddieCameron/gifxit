import GameGif from './models/gamegif'
import * as DB from "../server"
import Gif from '../models/gif'
import { PoolClient } from 'pg';

export async function chooseGifsForTurn(client: PoolClient, turnId: number, numTotalGifs: number, numTargetGifs: number) {
    const allGifs = await DB.query<Gif>(client, "SELECT * FROM gifs ORDER BY RANDOM() LIMIT $1", numTotalGifs);
    const gameGifs: GameGif[] = [];
    for (let i = 0; i < allGifs.length; i++) {
        const gif = allGifs[i];
        const gamegif = ( await DB.query<GameGif>(client,
            "INSERT INTO codegamegifs(gif_id, turn_id, is_target) VALUES($1, $2, $3) RETURNING *",
            gif.id, turnId, i < numTargetGifs
        ))[0];
        gamegif.url = gif.url;
    }
    return gameGifs;
}

export async function getGifsForTurn(client: PoolClient, turnId: number) {
    return await DB.query<GameGif>(client, "SELECT gamegifs.*, gif.url FROM codegamegifs gamegifs INNER JOIN gifs gif ON gamegifs.gif_id = gif.id WHERE gamegifs.turn_id = $1 ORDER BY gamegifs.gif_id", turnId);
}