import * as DB from "./server"
import Gif from "./models/gif"
import GameGif from "./models/gamegif"

export const HAND_SIZE = 5;

async function createGameCard(card_id: number, game_id: number, player_id: number) {
    return (await DB.query<GameGif>("INSERT INTO game_gifs(gif_id, game_id, player_id) VALUES($1, $2, $3) RETURNING *", card_id, game_id, player_id))[0];
}

export async function getCard(cardId: number) {
    return ( await DB.query<Gif>("SELECT * FROM gifs WHERE id=$1", cardId) )[0];
}

export async function getCards(cardIds: number[]) {
    return await DB.query<Gif>("SELECT * FROM gifs WHERE id = ANY($1)", cardIds);
}

export async function getPlayerCards(gameId: number, playerId: number) {
    return await DB.query<Gif>("SELECT gif.* FROM game_gifs game INNER JOIN gifs gif ON game.gif_id = gif.id WHERE game.player_id=$1 AND game.game_id=$2", playerId, gameId);
}

export async function dealCardsToPlayer(gameid: number, playerid: number) {
    const playercards = await getPlayerCards(gameid, playerid)

    const numCardsToDeal = HAND_SIZE - playercards.length;
    console.log( `Dealing ${numCardsToDeal} cards to ${playerid}` )

    if (numCardsToDeal > 0) {
        const allGifs = await DB.query<Gif>("SELECT * FROM gifs");
        const thisGameGifs = await DB.query<GameGif>("SELECT * FROM game_gifs WHERE game_id=$1", gameid);

        for (let i = 0; i < numCardsToDeal; i++) {
            for (let attempts = 0; attempts < 100; attempts++) {
                // try picking a new random card
                if (attempts == 99) {
                    // no more!
                    console.error("Ran out of new cards somehow");
                    return;
                }
                
                const nextCard = allGifs[Math.floor(Math.random() * allGifs.length)];
            
                if (playercards.some(c => c.id == nextCard.id)) {
                    // have alredy dealt this card
                    continue;
                }
                
                if (thisGameGifs.length < allGifs.length) {
                    // check that gif hasn't already been used
                    if (thisGameGifs.some(g => g.gif_id == nextCard.id)) {
                        continue;   // try again
                    }
                }

                // give card to player
                await createGameCard(nextCard.id, gameid, playerid);
                playercards.push(nextCard);
                break;
            }
        }
    }
    return playercards;
}