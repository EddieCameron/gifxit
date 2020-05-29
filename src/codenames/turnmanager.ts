import { getPlayersForGame, getPlayerWithId } from "./playercontroller";
import Game from "./models/game";
import { shuffle } from "../utilities";
import * as GameController from "./gamecontroller";
import { showNewTurnMessage, showChoosePromptMessage, showHintChosenMessage, postGifOptionsMessage, postChoseCorrectlyMessage, getGifOptionsMessage, postYouDidItMessage, postYouFuckedItMessage, postPlayerVoted } from "./slackobjects/messages";
import Player from "./models/player";
import GameTurn from "./models/gameturn";
import { getGifsForTurn, getGifVotesForTurn } from "./gifcontroller";
import GameGif from "./models/gamegif";

export async function startNextTurn(game: Game) {
    // TODO pick new player
    const players = await getPlayersForGame(game.id);
    
    const nextplayer = shuffle(players)[0] as Player

    const { turn, gifs } = await GameController.createTurn(game.id, nextplayer.id);
    gifs.sort((a, b) => a.gif_id - b.gif_id);

    // tell people that new game has started
    await showNewTurnMessage(game.workspace_id, game.slack_channel_id, nextplayer.slack_user_id );

    // prompt main player to pick their phrase
    await showChoosePromptMessage(game.workspace_id, game.slack_channel_id, nextplayer.slack_user_id);
} 

export async function createGame( slackWorkspace: string, slackChannel: string, slackUserId: string ) {
    console.log("Creating game in: " + slackChannel);
    const game = await GameController.createGame(slackWorkspace, slackChannel, slackUserId);
    return startNextTurn(game);
}

export async function mainPlayerChoose(turn: GameTurn, player: Player, keyword: string) {
    turn = await GameController.setKeyword(turn, keyword);

    const game = await GameController.getGameForId(turn.game_id);
    await showHintChosenMessage(game.workspace_id, game.slack_channel_id, player.slack_user_id);

    const allvotes = await getGifVotesForTurn(null, turn.id);
    await postGifOptionsMessage( game.workspace_id, game.slack_channel_id, turn, allvotes);
}

export async function gifLockedIn( game: Game, turn: GameTurn, lockedInGif: GameGif) {
    if (lockedInGif.is_target) {
        // correct choice!
        turn = await GameController.lockInGif(null, turn, lockedInGif.id);

        await postChoseCorrectlyMessage(game.workspace_id, game.slack_channel_id, lockedInGif);

        if (turn.chosen_d_gif_id) {
            // all gifs found!
            const mainPlayer = await getPlayerWithId(turn.player_id);
            await postYouDidItMessage(game.workspace_id, game.slack_channel_id, mainPlayer.slack_user_id, turn.current_keyword);
            
            startNextTurn(game);
        }
    }
    else {
        await postYouFuckedItMessage(game.workspace_id, game.slack_channel_id);
        
        startNextTurn(game);
    }
}

export async function gifVoted(game: Game, turn: GameTurn, player: Player, votedGif: GameGif) {
    await GameController.voteForGif(null, player.id, turn.id, votedGif.id);

    const allvotes = await getGifVotesForTurn(null, turn.id);
    if (turn.chosen_a_gif_id == votedGif.id || turn.chosen_b_gif_id == votedGif.id || turn.chosen_c_gif_id == votedGif.id || turn.chosen_d_gif_id == votedGif.id) {
        // already locked in this gif
    }
    else {
        // check if the votes should be locked in
        const thisGifVotes = allvotes.find(v => v.gif.id == votedGif.id);
        if (thisGifVotes.votes.length >= 3) {
            await gifLockedIn(game, turn, votedGif);
        }
    }

    postPlayerVoted(game.workspace_id, game.slack_channel_id, player.slack_user_id, votedGif);

    return getGifOptionsMessage(turn, allvotes);
}