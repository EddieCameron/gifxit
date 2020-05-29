import * as Slack from '../slack'
import { getGameForSlackChannel, getTurnForId } from './gamecontroller'
import { createGame, mainPlayerChoose, startNextTurn, gifLockedIn, gifVoted } from './turnmanager';
import { getOrCreatePlayerWithSlackId, getPlayerWithId } from './playercontroller';
import { getGifsForTurn, getGifVotesForTurn } from './gifcontroller';
import { showChoosePromptModal, CHOOSE_PROMPT_KEYWORD_BLOCK_ID } from './slackobjects/modals';
import { showChoosePromptMessage, postGifOptionsMessage } from './slackobjects/messages';

async function handleNoQuerySlash(workspace: string, channel: string, slackId: string): Promise<Slack.SlashResponse> {
    // see what we can do
    const game = await getGameForSlackChannel(channel);

    if (game === undefined) {
        // see if we want to start a new game
        createGame(workspace, channel, slackId);
        return { response_type: "ephemeral", text: "Starting game" };
    }
    
    if (game.current_turn_id == undefined) {
        // havent started a turn yet
        startNextTurn(game);
        return { response_type: "ephemeral", text: "Starting turn" };
    }

    const turn = await getTurnForId(game.current_turn_id);
    const thisPlayer = await getOrCreatePlayerWithSlackId(slackId, game.id);

    if (turn.current_keyword == undefined) {
        // main player hasn't chosen yet
        if (turn.player_id == thisPlayer.id) {
            // prompt main player turn
            await showChoosePromptMessage(game.workspace_id, game.slack_channel_id, thisPlayer.slack_user_id);
            return;
        }
        else {
            // TODO remind main player or skip option?
        }
    }
    else {
        const gifvotes = await getGifVotesForTurn(null, turn.id);
        await postGifOptionsMessage( game.workspace_id, game.slack_channel_id, turn, gifvotes);
    }
}

export async function handleSlash(slashPayload: Slack.SlashPayload): Promise<Slack.SlashResponse> {
    const slashQuery = slashPayload.text.split(' ')
    console.log( slashQuery.length)
    if (slashQuery.length < 2) {
        return handleNoQuerySlash(slashPayload.team_id, slashPayload.channel_id, slashPayload.user_id);
    }

    const game = await getGameForSlackChannel(slashPayload.channel_id);
    switch (slashQuery[1].toLowerCase()) {
        case "restartturn":
            startNextTurn(game);
            break;
    
        default:
            break;
    }
}

export async function handleChoosePromptButtonPressed(payload: Slack.ActionPayload, respond: (message: Slack.InteractiveMessageResponse) => void) {
    const game = await getGameForSlackChannel(payload.channel.id);

    if (game == undefined || game.current_turn_id == undefined)
        throw new Error("No game in this channel");
    
    const turn = await getTurnForId(game.current_turn_id);
    if (turn == undefined)
        throw new Error("No turn?");

    if (turn.current_keyword != undefined) {
        respond({ response_type: "ephemeral", replace_original: true, text: "Already a prompt chosen for this turn" });
        return;
    }
    
    const player = await getOrCreatePlayerWithSlackId(payload.user.id, game.id);
    if (player == undefined) {
        respond({ response_type: "ephemeral", replace_original: true, text: "You can't join this game" });
        return;
    }
    if (player.id != turn.player_id) {
        respond({ response_type: "ephemeral", replace_original: false, text: "It's not your turn!" });
        return;
    }
    
    const gifs = await getGifsForTurn(null, turn.id);

    // show modal
    try {
        await showChoosePromptModal(game.workspace_id, payload.trigger_id, turn.id, gifs);
    }
    catch(e) {
        respond({ response_type: "ephemeral", replace_original: false, text: "Something went wrong with Slack. Try again?" } );
    }
}

export async function handleChoosePromptDialogueSubmit(payload: Slack.ViewSubmissionPayload): Promise<Slack.InteractiveViewResponse> {
    const turnid = +payload.view.private_metadata;
    console.log("Prompt Chosen for turn " + turnid);

    const turn = await getTurnForId(turnid);
    if (turn == undefined) {
        throw new Error("Unknown Turn");
    }

    if (turn.current_keyword != undefined) {
        throw new Error("Hint already chosen this turn");
    } 

    const player = await getPlayerWithId(turn.player_id);
    console.log(JSON.stringify(payload));
    if (player == undefined) {
        throw new Error("Its not your turn to choose");
    }

    const chosenKeyword = payload.view.state.values[CHOOSE_PROMPT_KEYWORD_BLOCK_ID][CHOOSE_PROMPT_KEYWORD_BLOCK_ID + "_text"].value
    // TODO verify choices

    await mainPlayerChoose(turn, player, chosenKeyword);

    return undefined;
}

export async function handleLockInGifButtonPressed(payload: Slack.ActionPayload, respond: (message: Slack.InteractiveMessageResponse) => void) {
    const game = await getGameForSlackChannel(payload.channel.id);

    if (game == undefined || game.current_turn_id == undefined)
        throw new Error("No game in this channel");
    
    const turn = await getTurnForId(game.current_turn_id);
    if (turn == undefined)
        throw new Error("No turn?");

    if (turn.current_keyword == undefined) {
        respond({ response_type: "ephemeral", replace_original: false, text: "Prompt not yet chosen" });
        return;
    }

    const player = await getOrCreatePlayerWithSlackId(payload.user.id, game.id);
    if (player == undefined)
        throw new Error("Couldn't create player?");
    if (turn.player_id == player.id) {
        respond({ response_type: "ephemeral", replace_original: false, text: "Hey, you can't vote for your own gif" });
        return;
    }

    const lockedInGifId = +payload.actions[0].value;

    const gifs = await getGifsForTurn(null, turn.id);
    const chosenGif = gifs.find(g => g.id == lockedInGifId);
    if (chosenGif == undefined) {
        respond({ response_type: "ephemeral", replace_original: false, text: "Unknown gif chosen" });
        return;
    }

    try {
        const updatedMsg = await gifVoted(game, turn, player, chosenGif);
        console.log(payload.response_url);
        console.log("Updated votes msg: " + JSON.stringify(updatedMsg));
        respond({ replace_original: true, text: updatedMsg.text, blocks: updatedMsg.blocks });
        //Slack.postMessage(game.workspace_id, game.slack_channel_id, updatedMsg);
        console.log("responded");
    } catch (e) {
        respond({ response_type: "ephemeral", replace_original: false, text: "Voting failed. Did you already vote for this gif?" });
    }
}