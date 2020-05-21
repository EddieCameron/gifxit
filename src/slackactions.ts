import * as GameManager from "./gamemanager"
import * as PlayerController from "./playercontroller"
import * as GameController from "./gamecontroller"
import * as TurnManager from "./turnmanager"
import * as PlayerChoose from "./playerchoose"
import * as PlayerVotes from "./playervotes"
import * as Slack from "./slack"
import { addGif, removeGif } from "./addgif"
import Game from "./models/game"

const CREATE_GAME_ACTION_CALLBACK = "create_game_callback";
const createGameResponse: Slack.SlashResponse = {
    response_type: "ephemeral",
    text: "Do you want to start a game?",
    blocks: [
        {
            type: "section",
            text: {
                type: "mrkdwn",
                text: "Do you want to start a Gifxit game in this channel?"
            }
        },
        {
            type: "actions",
            elements: [
                {
                    action_id: CREATE_GAME_ACTION_CALLBACK,
                    type: "button",
                    text: {
                        type: "plain_text",
                        text: "YES"
                    },
                    style: "primary"
                }
            ]
        }
    ]
}

export async function handleCreateGameAction(payload: Slack.ActionPayload, respond: (message: Slack.InteractiveMessageResponse) => void): Promise<void> {
    const game = await GameManager.createGame(payload.team.id, payload.channel.id, payload.user.id);

    await TurnManager.startGame(game);
}

export async function handleRemindOtherPlayerChoose(payload: Slack.ActionPayload, respond: (message: Slack.InteractiveMessageResponse) => void) {
    const playerToRemind = +payload.actions[0].value;

    const game = await GameController.getGameForSlackChannel(payload.channel.id)
    if (game == undefined ) {
        respond({ replace_original: false, text: "This game doesn't exit or this has already been skipped" });
        return;
    }
    if (game.currentkeyword == undefined) {
        respond({ response_type: "ephemeral", text: "Main player still hasn't chosen" });
        return;
    }
    if (game.isvotingcomplete) {
        respond({ response_type: "ephemeral", text: "Voting is already complete" })
        return;
    }

    const player = await PlayerController.getPlayerWithId(playerToRemind);
    if (game.isreadytovote) {
        if (player.voted_gif_id != undefined) {
            respond({ replace_original: false, text: "This player has already voted" });
            return
        }
        const mainPlayer = await PlayerController.getPlayerWithId(game.currentplayerturn);
        await PlayerVotes.promptPlayerVote(game, mainPlayer, player);
    }
    else {
        const player = await PlayerController.getPlayerWithId(playerToRemind);
        if (player.chosen_gif_id != undefined) {
            respond({ replace_original: false, text: "This player has already chosen" });
            return
        }
        await PlayerChoose.promptOtherPlayerChoose(player.slack_user_id, game);
    }
}

export async function handleSkipOtherPlayersChooseAction(payload: Slack.ActionPayload, respond: (message: Slack.InteractiveMessageResponse) => void) {
    console.log("Skipping the other players");
    const turnIdx = +payload.actions[0].value;
    
    const game = await GameController.getGameForSlackChannel(payload.channel.id)
    if (game == undefined || game.currentturnidx != turnIdx) {
        respond({ replace_original: false, text: "This game doesn't exit or this has already been skipped" });
        return;
    }
    if (game.currentkeyword == undefined) {
        respond({ response_type: "ephemeral", text: "Main player still hasn't chosen" });
        return;
    }
    if (game.isvotingcomplete) {
        respond({ response_type: "ephemeral", text: "Voting is already complete" })
        return;
    }

    if (game.isreadytovote) {
        await TurnManager.scoreVotes(game);
    }
    else {
        await TurnManager.startVoting(game);
    }
}

export async function handleStartNextTurnAction(payload: Slack.ActionPayload, respond: (message: Slack.InteractiveMessageResponse) => void) {
    console.log("Starting next turn with random player");
    
    const game = await GameController.getGameForSlackChannel(payload.channel.id)
    if (game == undefined) {
        respond({ replace_original: true, text: "This game doesn't exist" });
        return;
    }

    if (game.currentturnidx != +payload.actions[0].value) {
        respond({ replace_original: true, text: "This turn has already started" });
        return;
    }

    await TurnManager.startNextTurnWithRandomPlayer(game);
    respond({ delete_original: true });
}

async function handleNoQuerySlash(game: Game, slackId: string): Promise<Slack.SlashResponse> {
    // see what we can do

    if (game === undefined) {
        // see if we want to start a new game
        return createGameResponse;
    }

    const thisPlayer = await PlayerController.getOrCreatePlayerWithSlackId(slackId, game.id);
    
    if (game.currentkeyword == undefined) {
        // main player hasn't chosen yet
        if (game.currentplayerturn == thisPlayer.id) {
            // prompt main player turn
            const message = PlayerChoose.getMainPlayerChoosePromptMessage(game.id, thisPlayer.id, game.currentturnidx);
            return { response_type: "ephemeral", text: message.text, blocks: message.blocks };
        }
        else {
            // TODO remind main player or skip option?
        }
    }
    else if (!game.isreadytovote) {
        // other players need to choose
        if (thisPlayer.chosen_gif_id == undefined) {
            //prompt other player choose card
            const allplayers = await PlayerController.getPlayersForGame(game.id);
            const mainPlayer = allplayers.find(p => p.id == game.currentplayerturn);
            const pickedplayers = allplayers.filter(p => p.id != game.currentplayerturn && p.chosen_gif_id != undefined);

            const message = TurnManager.getPlayerChooseSummaryMessage(game.currentturnidx, mainPlayer.slack_user_id, game.currentkeyword, pickedplayers, pickedplayers.length >= 2, game.choose_end_time);
            return { response_type: "ephemeral", text: message.text, blocks: message.blocks };
        }
        else {
            // just reprint summary
            await TurnManager.postNewChooseSummaryMessage(game);
            return;
        }
    }
    else if (!game.isvotingcomplete) {
        // we're voting
        if (thisPlayer.id != game.currentplayerturn && thisPlayer.chosen_gif_id != undefined && thisPlayer.voted_gif_id == undefined) {
            // prompt other player vote
            const mainPlayer = await PlayerController.getPlayerWithId(game.currentplayerturn);
            const message = PlayerVotes.getPlayerVotePrompt(game, mainPlayer, thisPlayer);
            return { response_type: "ephemeral", text: message.text, blocks: message.blocks };
        }
        else {
            // just print summary
            await TurnManager.postNewVoteSummaryMessage(game);
            return;
        }
    }
    else {
        return TurnManager.getNextTurnPrompt(game.currentturnidx);
    }

    return { response_type: "ephemeral", text: "There's nothing to do here..." };
}

// creates and runs games
export async function handleSlash(slashPayload: Slack.SlashPayload): Promise<Slack.SlashResponse> {
    // are we in a game channel
    const game = await GameController.getGameForSlackChannel(slashPayload.channel_id);

    console.log(slashPayload.text);
    const slashQuery = slashPayload.text.split(' ')
    console.log( slashQuery.length)
    if (slashQuery.length == 0) {
        return handleNoQuerySlash(game, slashPayload.user_id);
    }

    switch (slashQuery[0].toLowerCase()) {
        case "restartturn":
            TurnManager.debugRestartTurn(game);
            return { response_type: "ephemeral", text: "Restarting turn..." };
        
        case "startvote":
            TurnManager.debugStartVote(game);
            return { response_type: "ephemeral", text: "Voting..." };
        
        case "score":
            TurnManager.debugScoreTurn(game);
            return {response_type: "ephemeral", text: "Scoring turn..." };

        case "addgif":
            if (slashQuery.length < 2)
                return { response_type: "ephemeral", text: "Need to provide a GIF url" };
            return addGif(slashQuery[1]);

        case "removegif":
            if (slashQuery.length < 2)
                return { response_type: "ephemeral", text: "Need to provide a GIF url" };
            return removeGif(slashQuery[1]);
        
        default:
            return handleNoQuerySlash(game, slashPayload.user_id);
    }
}

export function init(): void {
    Slack.setSlashHandler(handleSlash);

    Slack.addActionHandler({ actionId: CREATE_GAME_ACTION_CALLBACK }, handleCreateGameAction);
    Slack.addActionHandler({ actionId: TurnManager.NEXT_TURN_CALLBACK }, handleStartNextTurnAction);
    Slack.addActionHandler({ actionId: PlayerChoose.START_MAIN_PLAYER_CHOOSE_ACTION_ID }, PlayerChoose.handleStartMainPlayerChoose);
    Slack.addActionHandler({ actionId: PlayerChoose.MAIN_PLAYER_PASS_ACTION_ID }, PlayerChoose.handleMainPlayerPass);
    Slack.addActionHandler({ actionId: PlayerChoose.START_OTHER_PLAYER_CHOOSE_ACTION_ID }, PlayerChoose.handleStartOtherPlayerChoose);
    Slack.addActionHandler({ actionId: PlayerChoose.CHOOSE_MAIN_PLAYER_REDEAL_CARDS_ACTION_ID }, PlayerChoose.handleMainPlayerRedealAction);
    Slack.addActionHandler({ actionId: PlayerChoose.CHOOSE_OTHER_PLAYER_REDEAL_CARDS_ACTION_ID }, PlayerChoose.handleOtherPlayerRedealAction);

    Slack.addActionHandler({ actionId: TurnManager.REMIND_CHOOSE_ACTION }, handleRemindOtherPlayerChoose);
    Slack.addActionHandler({ actionId: PlayerVotes.OPEN_VOTE_DIALOGUE_CALLBACK_ID }, PlayerVotes.handleOpenPlayerVoteDialogue);
    Slack.addActionHandler({ actionId: TurnManager.SKIP_ACTION }, handleSkipOtherPlayersChooseAction );
    
    Slack.addViewSubmissionHandler(PlayerChoose.CHOOSE_MAIN_PLAYER_MODAL_CALLBACK_ID, PlayerChoose.handleMainPlayerDialogueSubmit );
    Slack.addViewSubmissionHandler(PlayerChoose.CHOOSE_OTHER_PLAYER_MODAL_CALLBACK_ID, PlayerChoose.handleOtherPlayerDialogueSubmit );
    Slack.addViewSubmissionHandler(PlayerVotes.PLAYER_VOTE_ACTION_ID, PlayerVotes.handlePlayerVote);
}