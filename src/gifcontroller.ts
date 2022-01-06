import * as DB from "./server"
import Gif from "./models/gif"
import GameGif from "./models/gamegif"
import { PoolClient } from "pg";
import { getNewRandomGif, getNewTrendingGif } from "./giphy";
import { addGiphyGif } from "./addgif";

export const HAND_SIZE = 5;
export const NEW_GIF_CHANCE = .5;

async function createGameCard( pgClient: PoolClient, card_id: number, game_id: number, player_id: number) {
    return (await DB.query<GameGif>( pgClient, "INSERT INTO game_gifs(gif_id, game_id, player_id) VALUES($1, $2, $3) RETURNING *", card_id, game_id, player_id))[0];
}

export async function getCard(cardId: number) {
    return ( await DB.query<Gif>(null, "SELECT * FROM gifs WHERE id=$1", cardId) )[0];
}

export async function getGifWithGiphyId(id: string) {
    return (await DB.query<Gif>(null, "SELECT * FROM gifs WHERE giphy_id=$1", id))[0];
}

export async function getCards(cardIds: number[]) {
    return await DB.query<Gif>(null, "SELECT * FROM gifs WHERE id = ANY($1)", cardIds);
}

async function getPlayerCards(pgClient: PoolClient, gameId: number, playerId: number) {
    return await DB.query<Gif>( pgClient, "SELECT gif.* FROM game_gifs game INNER JOIN gifs gif ON game.gif_id = gif.id WHERE game.player_id=$1 AND game.game_id=$2", playerId, gameId);
}

async function deletePlayerCards(pgClient: PoolClient, gameId: number, playerId: number) {
    return await DB.query( pgClient, "DELETE FROM game_gifs WHERE player_id=$1 AND game_id=$2", playerId, gameId );
}

async function fillPlayerHand( pgClient: PoolClient, currentGifs: Gif[], gameId: number, playerId: number) {
    const numCardsToDeal = HAND_SIZE - currentGifs.length;
    console.log( `Dealing ${numCardsToDeal} cards to ${playerId}` )

    if (numCardsToDeal > 0) {
        const allGifs = await DB.query<Gif>(pgClient, "SELECT * FROM gifs");
        const thisGameGifs = await DB.query<GameGif>( pgClient, "SELECT * FROM game_gifs WHERE game_id=$1", gameId);
        const chosenGifs = await DB.query<number>( pgClient, "SELECT chosen_gif_id FROM players WHERE game_id=$1", gameId)
        
        for (let i = 0; i < numCardsToDeal; i++) {
            for (let attempts = 0; attempts < 100; attempts++) {
                // try picking a new random card
                if (attempts == 99) {
                    // no more!
                    console.error("Ran out of new cards somehow");
                    return;
                }

                let nextCard: Gif;
                if (Math.random() < NEW_GIF_CHANCE) {
                    const randomGif = await getNewTrendingGif();
                    nextCard = await addGiphyGif(randomGif);
                }
                else {
                    nextCard = allGifs[Math.floor(Math.random() * allGifs.length)];

                    if (currentGifs.some(c => c.id == nextCard.id)) {
                        // have alredy dealt this card
                        continue;
                    }
                
                    if (thisGameGifs.length < allGifs.length) {
                        // check that gif hasn't already been dealt
                        if (thisGameGifs.some(g => g.gif_id == nextCard.id)) {
                            continue;   // try again
                        }
                    }
                
                    if (chosenGifs.length < allGifs.length) {
                        // check that gif hasn't already been chosen
                        if (chosenGifs.some(g => g == nextCard.id)) {
                            continue;   // try again
                        }
                    }
                }

                // give card to player
                await createGameCard(pgClient, nextCard.id, gameId, playerId);
                currentGifs.push(nextCard);
                break;
            }
        }
    }
    return currentGifs;
    
}

export async function redealCardsToPlayer(gameId: number, playerId: number, gameTurnIdx: number) {
    let gifs: Gif[] = []
    await DB.transactionCallback( async client => {
        await deletePlayerCards(client, gameId, playerId);
        gifs = await fillPlayerHand( client, [], gameId, playerId);
        client.query("UPDATE players SET last_refresh_on_turn = $1 WHERE id=$2", [gameTurnIdx, playerId]);
    });

    return gifs;
}

export async function dealCardsToPlayerInTransaction(client: PoolClient, gameid: number, playerid: number) {
    const playercards = await getPlayerCards(client, gameid, playerid)
    return await fillPlayerHand(client, playercards, gameid, playerid);
}


export async function dealCardsToPlayer(gameid: number, playerid: number) {
    let gifs: Gif[] = []
    await DB.transactionCallback(async client => {
        gifs = await dealCardsToPlayerInTransaction( client, gameid, playerid)
    });
    return gifs;
}