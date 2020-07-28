import Lol from "./models/lol"
import * as DB from "./server"

export async function hasSlackUserLolled(slackId: string, gameId: number, turnIdx: number) {
    const votes = await DB.query<Lol>(null, "SELECT * FROM lols WHERE byslackid=$1 AND game=$2 AND turn=$3", slackId, gameId, turnIdx);
    return votes.length > 0;
}

export async function getLolForPlayer(slackId: string, gameId: number, turnIdx: number) {
    const votes = await DB.query<Lol>(null, "SELECT * FROM lols WHERE byslackid=$1 AND game=$2 AND turn=$3", slackId, gameId, turnIdx);
    if (votes.length == 0)
        return null;
    else
        return votes[0];
}

export async function addLol(slackId: string, gameId: number, turnIdx: number, forPlayer: number, forGif: number) {
    return (await DB.query<Lol>( null, "INSERT INTO lols(game, byslackid, turn, forplayerid, forgif) VALUES($1, $2, $3, $4, $5) RETURNING *", gameId, slackId, turnIdx, forPlayer, forGif))[0];
}

export async function getLolsForTurn(gameId: number, turnIdx: number) {
    return await DB.query<Lol>(null, "SELECT * FROM lols WHERE game=$1 AND turn=$2", gameId, turnIdx);
}