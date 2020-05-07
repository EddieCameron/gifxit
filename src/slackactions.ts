import * as GameManager from "./gamemanager"
import * as PlayerController from "./playercontroller"
import * as GameController from "./gamecontroller"
import * as TurnManager from "./turnmanager"
import * as PlayerChoose from "./playerchoose"
import * as PlayerVotes from "./playervotes"
import * as Slack from "./slack"
import * as PlayerInvite from "./playerinvite"
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

const JOIN_GAME_ACTION_CALLBACK = "join_game_callback";
export function getJoinGameReponse(gameId: number): Slack.SlashResponse {
    return {
        response_type: "ephemeral",
        text: "Do you want to join this game?",
        blocks: [
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: "Do you want to join the Gifxit game in this channel?"
                }
            },
            {
                type: "actions",
                elements: [
                    {
                        action_id: JOIN_GAME_ACTION_CALLBACK,
                        type: "button",
                        text: {
                            type: "plain_text",
                            text: "Join"
                        },
                        style: "primary",
                        value: gameId.toString()
                    }
                ]
            }
        ]
    }
}

const INVITE_PLAYER_CALLBACK = "invite_player_callback";
const START_GAME_ACTION_CALLBACK = "start_game_callback";
const unStartedGameActionsPrompt: Slack.SlashResponse = {
    response_type: "ephemeral",
    text: "Do you want to begin the game?",
    blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "Invite another player to the game"
          },
          accessory: {
            action_id: INVITE_PLAYER_CALLBACK,
            type: "users_select",
            placeholder: {
              type: "plain_text",
              text: "Choose a player"
            }
          }
        },
        {
            type: "section",
            text: {
                type: "mrkdwn",
                text: "Do you want to begin playing the game in this channel?"
            }
        },
        {
            type: "context",
            elements: [ {
                type: "mrkdwn",
                text: "Make sure you're ready, no one can join once the game starts"
            } ]
        },
        {
            type: "actions",
            elements: [
                {
                    action_id: START_GAME_ACTION_CALLBACK,
                    type: "button",
                    text: {
                        type: "plain_text",
                        text: "START!"
                    }
                }
            ]
        }
    ]
}

export async function handleCreateGameAction(payload: Slack.ActionPayload, respond: (message: Slack.InteractiveMessageResponse) => void): Promise<void> {
    await GameManager.createGame(payload.channel.id, payload.user.id);

    respond({ replace_original: true, text: unStartedGameActionsPrompt.text, blocks: unStartedGameActionsPrompt.blocks });
}

export async function handleJoinGameAction(payload: Slack.ActionPayload, respond: (message: Slack.InteractiveMessageResponse) => void) {
    const gameId = +payload.actions[0].value;
    console.log("Joining game " + gameId);
    await GameManager.joinGame(gameId, payload.user.id);
    respond({ delete_original: true });
}

export async function handleStartGameAction(payload: Slack.ActionPayload, respond: (message: Slack.InteractiveMessageResponse) => void) {
    console.log("Beginning game in: " + payload.channel.id);
    const game = await GameController.getGameForSlackChannel(payload.channel.id)
    if (game.currentturnidx > 0) {
        respond({ replace_original: true, text: "This game has already started" });
        return;
    }

    await TurnManager.startGame(game.id);
    respond({ delete_original: true });
}

export async function handleInvitePlayerAction(payload: Slack.ActionPayload, respond: (message: Slack.InteractiveMessageResponse) => void) {
    const invitedPlayer = payload.actions[0].selected_user;
    console.log("Inviting player " + invitedPlayer);
    
    const game = await GameController.getGameForSlackChannel(payload.channel.id)
    if (game == undefined) {
        respond({ replace_original: true, text: "This game doesn't exit or has already started" });
        return;
    }

    await PlayerInvite.invitePlayer(game, invitedPlayer, payload.user.id);
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

    if (game.isreadytovote) {
        await TurnManager.scoreVotes(game);
    }
    else {
        await TurnManager.startVoting(game);
    }
}

export async function handleStartNextTurnAction(payload: Slack.ActionPayload, respond: (message: Slack.InteractiveMessageResponse) => void) {
    console.log("Starting next turn");
    
    const game = await GameController.getGameForSlackChannel(payload.channel.id)
    if (game == undefined) {
        respond({ replace_original: true, text: "This game doesn't exist" });
        return;
    }

    if (game.currentturnidx != +payload.actions[0].value) {
        respond({ replace_original: true, text: "This turn has already started" });
        return;
    }

    await TurnManager.startNextTurn(game.id);
    respond({ delete_original: true });
}

async function handleNoQuerySlash(game: Game, slackId: string): Promise<Slack.SlashResponse> {
    // see what we can do

    if (game === undefined) {
        // see if we want to start a new game
        return createGameResponse;
    }

    const players = await PlayerController.getPlayersForGame(game.id);
    const thisPlayer = players.find( p => p.slack_user_id == slackId )
    if (thisPlayer != undefined) {
        // we're in this game
        if (game.currentturnidx == 0) {
            // game hasn't started yet
            return unStartedGameActionsPrompt;
        }
        else if (game.currentkeyword == undefined) {
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
                const mainPlayer = players.find(p => p.id == game.currentplayerturn);
                const message = TurnManager.getMainPlayerChoseMessage(mainPlayer.slack_user_id, game.currentkeyword, game.currentturnidx);
                return { response_type: "ephemeral", text: message.text, blocks: message.blocks };
            }
            else {
                // just reprint summary
                await TurnManager.postNewChooseSummaryMessage(game);
                return;
            }
        }
        else {
            // we're voting
            if (thisPlayer.id != game.currentplayerturn && thisPlayer.voted_gif_id == undefined) {
                // prompt other player vote
                const mainPlayer = players.find(p => p.id == game.currentplayerturn);
                const message = PlayerVotes.getPlayerVotePrompt(game, mainPlayer, thisPlayer);
                return { response_type: "ephemeral", text: message.text, blocks: message.blocks };
            }
            else {
                // just print summary
                await TurnManager.postNewVoteSummaryMessage(game);
                return;
            }
        }
    }
    else {
        return getJoinGameReponse(game.id);
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

export async function handleReceivedMessage(message: Slack.MessageEvent) {
    // const player = await PlayerController.getPlayerWithSlackId(message.user);
    // if (player == undefined)
    //     return;
    
    // const game = await GameController.getGameForId(player.game_id);

    // if (game == undefined || game.currentplayerturn != player.id || game.currentkeyword != undefined) {
    //     console.log("Not waiting for a keyword");
    //     return;
    // }

    // await TurnManager.chooseKeyword(game.id, message.text);

    // await Slack.postMessage(message.channel, { text: "👌" });
}

export function init(): void {
    Slack.setSlashHandler(handleSlash);
    Slack.setMessageEventHandler(handleReceivedMessage);

    Slack.addActionHandler({ actionId: CREATE_GAME_ACTION_CALLBACK }, handleCreateGameAction);
    Slack.addActionHandler({ actionId: JOIN_GAME_ACTION_CALLBACK }, handleJoinGameAction);
    Slack.addActionHandler({ actionId: START_GAME_ACTION_CALLBACK }, handleStartGameAction);
    Slack.addActionHandler({ actionId: INVITE_PLAYER_CALLBACK }, handleInvitePlayerAction);
    Slack.addActionHandler({ actionId: TurnManager.NEXT_TURN_CALLBACK }, handleStartNextTurnAction);
    Slack.addActionHandler({ actionId: PlayerInvite.ACCEPT_INVITE_CALLBACK }, handleJoinGameAction);
    Slack.addActionHandler({ actionId: PlayerChoose.START_MAIN_PLAYER_CHOOSE_ACTION_ID }, PlayerChoose.handleStartMainPlayerChoose);
    Slack.addActionHandler({ actionId: PlayerChoose.MAIN_PLAYER_PASS_ACTION_ID }, PlayerChoose.handleMainPlayerPass);
    Slack.addActionHandler({ actionId: PlayerChoose.START_OTHER_PLAYER_CHOOSE_ACTION_ID }, PlayerChoose.handleStartOtherPlayerChoose);
    Slack.addActionHandler({ actionId: TurnManager.REMIND_CHOOSE_ACTION }, handleRemindOtherPlayerChoose);
    Slack.addActionHandler({ actionId: PlayerVotes.OPEN_VOTE_DIALOGUE_CALLBACK_ID }, PlayerVotes.handleOpenPlayerVoteDialogue);
    Slack.addActionHandler({ actionId: TurnManager.SKIP_ACTION }, handleSkipOtherPlayersChooseAction );
    
    Slack.addViewSubmissionHandler(PlayerChoose.CHOOSE_MAIN_PLAYER_MODAL_CALLBACK_ID, PlayerChoose.handleMainPlayerDialogueSubmit );
    Slack.addViewSubmissionHandler(PlayerChoose.CHOOSE_OTHER_PLAYER_MODAL_CALLBACK_ID, PlayerChoose.handleOtherPlayerDialogueSubmit );
    Slack.addViewSubmissionHandler(PlayerVotes.PLAYER_VOTE_ACTION_ID, PlayerVotes.handlePlayerVote);
}