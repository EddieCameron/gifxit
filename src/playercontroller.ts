import * as DB from "./server"
import * as GifController from "./gifcontroller"
import * as Slack from "./slack"
import Player from "./models/player";
import GifVote from "./models/gifvotes";

async function updatePlayerSlackName(player: Player) {
    // need scope
    // const userResponse = await Slack.getSlackUser(player.slack_user_id);
    // if (userResponse.ok) {
    //     const slackName = userResponse.user.profile.display_name ?? userResponse.user.profile.real_name ?? userResponse.user.name;
    //     return ( await DB.query<Player>("UPDATE players SET slack_name = $1 WHERE id=$2 RETURNING *", slackName, player.id) )[0];
    // }
    // else {
    //     console.error( "Couldn't update player slack name: " + userResponse.error);
    //     return player;
    // }
    return player;
}

async function updatePlayerSlackNameIfNeeded(player: Player) {
    if (player.slack_name == undefined)
        return updatePlayerSlackName(player);
    else
        return player;
}

export async function getPlayersForGame(id: number) {
    console.log("Getting players for game " + id);
    const players = await DB.query<Player>("SELECT * FROM players WHERE game_id=$1", id);

    return Promise.all(players.map(p => updatePlayerSlackNameIfNeeded(p)));
}

export async function getPlayerWithId(playerid: number) {
    return updatePlayerSlackNameIfNeeded( ( await DB.query<Player>("SELECT * FROM players WHERE id=$1", playerid))[0] );
}

async function createPlayer(slack_id: string, game_id: number) {
    console.log("creating player" ); 
    return (await DB.query<Player>("INSERT INTO players(slack_user_id, game_id) VALUES($1, $2) RETURNING *", slack_id, game_id))[0];
}

export async function getOrCreatePlayerWithSlackId(slack_id: string, gameId: number) {
    await DB.beginTransaction();

    let player: Player;

    // set as chosen
    const playerMatches = await DB.query<Player>("SELECT * FROM players WHERE slack_user_id=$1 AND game_id=$2", slack_id, gameId);
    if (playerMatches.length > 0) {
        player = await updatePlayerSlackNameIfNeeded(playerMatches[0]);
    }
    else {
        player = await createPlayer(slack_id, gameId);
        await GifController.dealCardsToPlayer(gameId, player.id);
    }
    
    await DB.commitTransaction();

    return player;
}

// returns players that have still not chosen a gif
export async function setChosenGif(playerId: number, gifId: number, gameId: number) {
    const results = await DB.transaction([
        {
            // set as chosen
            text: "UPDATE players SET chosen_gif_id = $1 WHERE id=$2",
            values: [gifId, playerId]
        },
        {
            // remove from hand
            text: "DELETE FROM game_gifs WHERE gif_id=$1 AND player_id=$2",
            values: [gifId, playerId]
        },
        {
            // get players that haven't yet chosen
            text: "SELECT * FROM PLAYERS WHERE game_id =$1 AND chosen_gif_id IS NULL",
            values: [gameId]
        }
    ]);
    return results[2].rows.map(p => p as Player);
}

// returns players that have still not chosen a gif
export async function voteForGif(playerId: number, gifId: number, gameId: number) {
    const results = await DB.transaction([
        {
            // set as voted
            text: "UPDATE players SET voted_gif_id = $1 WHERE id=$2",
            values: [gifId, playerId]
        },
        {
            // get players that haven't yet voted
            text: "SELECT * FROM PLAYERS WHERE game_id=$1 AND voted_gif_id IS NULL",
            values: [gameId]
        }
    ]);
    return results[1].rows.map(p => p as Player);
}

export async function getAllVotes(gameId: number) {
    const players = await getPlayersForGame(gameId);

    const gifVotes: GifVote[] = []
    for (const player of players) {
        if (player.chosen_gif_id == undefined)
            continue;
        
        const gif = await GifController.getCard(player.chosen_gif_id);
        const votes = players.filter(p => p.voted_gif_id != undefined && p.voted_gif_id == player.chosen_gif_id);
        gifVotes.push({
            gif: gif,
            chosenByPlayer: player,
            votes: votes
        });
    }
    return gifVotes;
}

export async function addPoints(playerId: number, pointsToAdd: number) {
    return (await DB.query<Player>("UPDATE players SET score = score + $1 WHERE id=$2 RETURNING *", pointsToAdd, playerId))[0];
}

export async function resetPlayersForNewTurn(gameId: number ) {
    return DB.query<Player>(
        "UPDATE players SET chosen_gif_id = NULL, voted_gif_id = NULL WHERE game_id=$1 RETURNING *",
        gameId);
}


