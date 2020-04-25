import * as GameManager from "./gamemanager"
import * as PlayerController from "./playercontroller"
import * as GameController from "./gamecontroller"
import * as TurnManager from "./turnmanager"
import * as PlayerChoose from "./playerchoose"
import * as PlayerVotes from "./playervotes"
import * as Slack from "./slack"
import { addGif } from "./addgif"
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
const joinGameReponse: Slack.SlashResponse = {
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
                    style: "primary"
                }
            ]
        }
    ]
}

const START_GAME_ACTION_CALLBACK = "start_game_callback";
const startGamePrompt: Slack.SlashResponse = {
    response_type: "ephemeral",
    text: "Do you want to begin the game?",
    blocks: [
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
    respond({ delete_original: true });
}

export async function handleJoinGameAction(payload: Slack.ActionPayload, respond: (message: Slack.InteractiveMessageResponse) => void) {
    console.log("Joining game in: " + payload.channel.id);
    await GameManager.joinGame(payload.channel.id, payload.user.id);
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

async function handleNoQuerySlash(game: Game, slackId: string) {
    // see what we can do

    if (game === undefined) {
        // see if we want to start a new game
        return createGameResponse;
    }

    const players = await PlayerController.getPlayersForGame(game.id);
    if (players.some(p => p.slack_user_id == slackId)) {
        // we're in this game
        return startGamePrompt;
    }
    else {
        return joinGameReponse;
    }
}

// creates and runs games
export async function handleSlash(slashPayload: Slack.SlashPayload): Promise<Slack.SlashResponse> {
    // are we in a game channel
    const game = await GameController.getGameForSlackChannel(slashPayload.channel_id);

    console.log(slashPayload.text);
    const slashQuery = slashPayload.text.toLowerCase().split(' ')
    console.log( slashQuery.length)
    if (slashQuery.length == 0) {
        return handleNoQuerySlash(game, slashPayload.user_id);
    }

    switch (slashQuery[0].toLowerCase()) {
        case "score":
            TurnManager.debugScoreTurn(game);
            return {response_type: "ephemeral", text: "Scoring turn..." };

        case "addgif":
            if (slashQuery.length < 2)
                return { response_type: "ephemeral", text: "Need to provide a GIF url" };
            return addGif(slashQuery[1]);
        
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
    Slack.addActionHandler({ actionId: PlayerChoose.START_MAIN_PLAYER_CHOOSE_ACTION_ID }, PlayerChoose.handleStartMainPlayerChoose);
    Slack.addActionHandler({ actionId: PlayerChoose.START_OTHER_PLAYER_CHOOSE_ACTION_ID }, PlayerChoose.handleStartOtherPlayerChoose);
    Slack.addActionHandler({ actionId: PlayerVotes.PLAYER_VOTE_ACTION_ID }, PlayerVotes.handlePlayerVote);
    
    Slack.addViewSubmissionHandler(PlayerChoose.CHOOSE_MAIN_PLAYER_MODAL_CALLBACK_ID, PlayerChoose.handleMainPlayerDialogueSubmit );
    Slack.addViewSubmissionHandler(PlayerChoose.CHOOSE_OTHER_PLAYER_MODAL_CALLBACK_ID, PlayerChoose.handleOtherPlayerDialogueSubmit );
}