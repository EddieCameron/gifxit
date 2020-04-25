import * as DB from "./server"
import Gif from "./models/gif"
import GameGif from "./models/gamegif"

const gifs: Gif[] = []
const gifsById: { [id: number]: Gif } = {}
const gameGifs: { [gameid: number]: GameGif[] } = {}

async function loadGifs() {
    if (gifs.length == 0) {
        const dbgifs = await DB.query<Gif>("SELECT * FROM gifs");
        console.log(dbgifs.length);
        Array.prototype.push.apply(gifs, dbgifs)
        console.log(gifs.length);
        for (const gif of gifs) {
            gifsById[gif.id] = gif;
        }
    }
}

async function loadGameGifs(gameid: number) {
    if (gameGifs[gameid] != undefined)
        return gameGifs[gameid];
    
    gameGifs[gameid] = await DB.query<GameGif>("SELECT * FROM game_gifs WHERE game_id=$1", gameid);
    return gameGifs[gameid];
}

async function createGameCard(card_id: number, game_id: number, player_id: number) {
    const gamecard = (await DB.query<GameGif>("INSERT INTO game_gifs(gif_id, game_id, player_id) VALUES($1, $2, $3) RETURNING *", card_id, game_id, player_id))[0];
    gameGifs[game_id].push(gamecard);
    return gamecard;
}

export async function getCard(cardId: number) {
    await loadGifs();
    return gifsById[cardId];
}

export async function getCards(cardIds: number[]) {
    await loadGifs();
    const cards = []
    for (const cardId of cardIds) {
        cards.push(gifsById[cardId]);
    }
    return cards
}

export async function getPlayerCards(gameid: number, playerid: number) {
    await loadGifs();
    const allGameGifs = await loadGameGifs(gameid);

    return allGameGifs.filter((g) => g.player_id == playerid).map(g => gifsById[g.gif_id]);
}

export async function dealCardsToPlayer(gameid: number, playerid: number, numCardsToDeal: number) {
    const [thisGameGifs] = await Promise.all([
        loadGameGifs(gameid),
        loadGifs()]);

    const newCards: GameGif[] = []
    for (let i = 0; i < numCardsToDeal; i++) {
        for (let attempts = 0; attempts < 100; attempts++) {
            // try picking a new random card
            if (attempts == 99) {
                // no more!
                console.error("Ran out of new cards somehow");
                return;
            }
                
            const nextCard = gifs[Math.floor(Math.random() * gifs.length)];
            
            if (newCards.some(c => c.gif_id == nextCard.id)) {
                // have alredy dealt this card
                continue;
            }
                
            if (thisGameGifs.length < gifs.length) {
                // check that gif hasn't already been used
                if (thisGameGifs.some(g => g.gif_id == nextCard.id)) {
                    continue;   // try again
                }
            }

            // give card to player
            newCards.push( await createGameCard(nextCard.id, gameid, playerid) );
            break;
        }
    }    
}