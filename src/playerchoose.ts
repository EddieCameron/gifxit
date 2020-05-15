import { View, Option, InputBlock } from "@slack/web-api";
import Gif from "./models/gif";
import * as Slack from "./slack"
import * as TurnManager from "./turnmanager"
import * as GameController from "./gamecontroller"
import * as GifController from "./gifcontroller"
import * as PlayerController from "./playercontroller"
import Game from "./models/game";
import { DialogueMetadata } from "./gamemanager";

export const START_MAIN_PLAYER_CHOOSE_ACTION_ID = "start_main_player_choose";
export const MAIN_PLAYER_PASS_ACTION_ID = "main_player_pass";

export function getMainPlayerChoosePromptMessage(gameId: number, playerId: number, turnIdx: number) {
    const metadata: DialogueMetadata = {
        gameId: gameId,
        playerId: playerId,
        turnIdx: turnIdx,
    }

    return {
        text: "It's your turn!",
        blocks: [
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: "🕹 It's your turn! 🕹"
                }
            },
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: "When you can, write a short message and choose a GIF that would be a good response to it"
                }
            },
            {
                type: "context",
                elements: [{
                    type: "mrkdwn",
                    text: "Careful, if it's too obvious or too obscure, you won't get any points."
                }
                ]
            },
            {
                type: "actions",
                elements: [
                    {
                        action_id: START_MAIN_PLAYER_CHOOSE_ACTION_ID,
                        type: "button",
                        text: {
                            type: "plain_text",
                            text: "Choose"
                        },
                        style: "primary",
                        value: JSON.stringify(metadata)
                    },
                    {
                        action_id: MAIN_PLAYER_PASS_ACTION_ID,
                        type: "button",
                        text: {
                            type: "plain_text",
                            text: "Skip My Turn"
                        },
                        style: "danger",
                        value: JSON.stringify(metadata)
                    }
                ]
            }
        ]
    }
}

export const START_OTHER_PLAYER_CHOOSE_ACTION_ID = "start_other_player_choose";
export function getOtherPlayerChoosePrompt(turnIdx: number) {
    return {
        text: "You can choose a gif",
        blocks: [
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: "🕹 Choose a GIF 🕹"
                }
            },
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `Pick a reaction GIF for their message`
                },
                accessory: {
                    type: "button",
                    text: {
                        type: "plain_text",
                        text: "Pick a GIF"
                    },
                    style: "primary",
                    value: turnIdx.toString(),
                    action_id: START_OTHER_PLAYER_CHOOSE_ACTION_ID
                }
            }
        ]
    }
}

export const CHOOSE_MAIN_PLAYER_REDEAL_CARDS_ACTION_ID = "choose_main_player_redeal_action_id";
export const CHOOSE_MAIN_PLAYER_MODAL_CALLBACK_ID = "choose_main_player_callback";
const CHOOSE_MAIN_PLAYER_CARD_BLOCK_ID = "choose_main_player_card";
const CHOOSE_MAIN_PLAYER_KEYWORD_BLOCK_ID = "choose_main_player_keyword";
function getMainPlayerChooseDialogue(cards: Gif[], gameId: number, playerId: number, turnIdx: number, showRefreshButton: boolean): View {
    const metadata: DialogueMetadata = {
        gameId: gameId,
        playerId: playerId,
        turnIdx: turnIdx,
    }

    const message: View = {
        type: "modal",
        callback_id: CHOOSE_MAIN_PLAYER_MODAL_CALLBACK_ID,
        private_metadata: JSON.stringify( metadata ),
        title: {
            "type": "plain_text",
            "text": "🕹 Choose your GIF 🕹",
            "emoji": true
        },
        "submit": {
            "type": "plain_text",
            "text": "Choose",
            "emoji": true
        },
        "close": {
            "type": "plain_text",
            "text": "Cancel",
            "emoji": true
        },
        blocks: [{
            type: "section",
            text: {
                type: "plain_text",
                text: "Your GIFS"
            }
        }]
    };

    // what's in your hand
    const options: Option[] = []
    for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        // add card description
        const sections = TurnManager.getBigCardSections(card, i + 1)
        message.blocks = message.blocks.concat(sections);
        message.blocks.push({ type: "divider" });
        options.push({
            text: {
                type: "plain_text",
                text: (i + 1).toString()
            },
            value: card.id.toString()
        });
    }

    if (showRefreshButton) {
        message.blocks.push( {
            type: "section",
            text: {
                type: "mrkdwn",
                text: `I'm sick of these GIFs, give me some new ones`
            },
            accessory: {
                type: "button",
                text: {
                    type: "plain_text",
                    text: "Refresh GIFs"
                },
                action_id: CHOOSE_MAIN_PLAYER_REDEAL_CARDS_ACTION_ID
            }
        })
    }

    message.blocks.push({
        block_id: CHOOSE_MAIN_PLAYER_CARD_BLOCK_ID,
        type: "input",
        "label": {
            "type": "plain_text",
            "text": "Choose a GIF",
            "emoji": true
        },
        "element": {
            type: "radio_buttons",
            action_id: CHOOSE_MAIN_PLAYER_CARD_BLOCK_ID + "_menu",
            options: options
        }
    } as InputBlock);

    // keyword entry
    message.blocks.push({
        block_id: CHOOSE_MAIN_PLAYER_KEYWORD_BLOCK_ID,
        type: "input",
        "label": {
            "type": "plain_text",
            "text": "Write a message that your GIF could be a reaction to",
            "emoji": true
        },
        "hint": {
            "type": "plain_text",
            "text": "Careful, if it's too obvious or too obscure, you won't get any points.",
            "emoji": true
        },
        "element": {
            "type": "plain_text_input",
            "action_id": CHOOSE_MAIN_PLAYER_KEYWORD_BLOCK_ID + "_text",
            min_length: 3,
            max_length: 512
        }
    });

    return message;
}

export const CHOOSE_OTHER_PLAYER_REDEAL_CARDS_ACTION_ID = "choose_other_player_redeal_action_id";
export const CHOOSE_OTHER_PLAYER_MODAL_CALLBACK_ID = "choose_other_player_callback";
const CHOOSE_OTHER_PLAYER_CARD_BLOCK_ID = "choose_other_player_card";
function getOtherPlayerChooseDialogue(cards: Gif[], keyword: string, mainPlayerSlackId: string, gameId: number, playerId: number, turnIdx: number, showRefreshButton: boolean): View {
    const metadata: DialogueMetadata = {
        gameId: gameId,
        playerId: playerId,
        turnIdx: turnIdx,
    }

    const message: View = {
        type: "modal",
        callback_id: CHOOSE_OTHER_PLAYER_MODAL_CALLBACK_ID,
        private_metadata: JSON.stringify( metadata ),
        title: {
            "type": "plain_text",
            "text": "🕹 Choose your GIF 🕹",
            "emoji": true
        },
        "submit": {
            "type": "plain_text",
            "text": "Choose",
            "emoji": true
        },
        "close": {
            "type": "plain_text",
            "text": "Cancel",
            "emoji": true
        },
        blocks: [{
            type: "section",
            text: {
                type: "plain_text",
                text: "Your GIFS"
            }
        }]
    };

    // what's in your hand
    const options: Option[] = []
    for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        // add card description
        const sections = TurnManager.getBigCardSections(card, i + 1)
        message.blocks = message.blocks.concat(sections);
        message.blocks.push({ type: "divider" });
        options.push({
            text: {
                type: "plain_text",
                text: (i + 1).toString()
            },
            value: card.id.toString()
        });
    }

    message.blocks.push({
        type: "context",
        elements: [{
            type: "mrkdwn",
            text: `Remember, you want the other players to think the GIF came from <@${mainPlayerSlackId}>`
        }
        ]
    })

    message.blocks.push({
        block_id: CHOOSE_OTHER_PLAYER_CARD_BLOCK_ID,
        type: "input",
        "label": {
            "type": "plain_text",
            text: `Choose a GIF you think <@${mainPlayerSlackId}> could have found with *${keyword}*`,
            "emoji": true
        },
        "element": {
            type: "radio_buttons",
            action_id: CHOOSE_OTHER_PLAYER_CARD_BLOCK_ID + "_menu",
            options: options
        }
    });

    if (showRefreshButton) {
        message.blocks.push( {
            type: "section",
            text: {
                type: "mrkdwn",
                text: `I'm sick of these GIFs, give me some new ones`
            },
            accessory: {
                type: "button",
                text: {
                    type: "plain_text",
                    text: "Refresh GIFs"
                },
                action_id: CHOOSE_OTHER_PLAYER_REDEAL_CARDS_ACTION_ID
            }
        })
    }

    return message;
}

export async function handleStartMainPlayerChoose(payload: Slack.ActionPayload, respond: (message: Slack.InteractiveMessageResponse) => void) {
    console.log("Main player is choosing...");
    const metadata = JSON.parse(payload.actions[0].value) as DialogueMetadata;

    const game = await GameController.getGameForId(metadata.gameId);
    if (game == undefined || game.currentturnidx != metadata.turnIdx || game.currentkeyword != undefined) {
        respond({ replace_original: false, response_type: "ephemeral", text: "It's not your turn to choose a message" });
        return;
    }
    if (metadata.playerId != game.currentplayerturn)
        respond({ response_type: "ephemeral", replace_original: false, text: "It's not your turn to choose a message" });
    
    const cards = await GifController.dealCardsToPlayer(metadata.gameId, metadata.playerId);
    const player = await PlayerController.getPlayerWithId(game.currentplayerturn);

    const modal = getMainPlayerChooseDialogue(cards, game.id, metadata.playerId, game.currentturnidx, player.last_refresh_on_turn < game.currentturnidx);
    try {
        await Slack.showModal(game.workspace_id, payload.trigger_id, modal);
    }
    catch (e) {
        respond({ response_type: "ephemeral", replace_original: false, text: "Something went wrong with Slack. Try again?" });
    }
    // TODO delete message if modal is cancelled
    // respond({ delete_original: true });
}

export async function handleMainPlayerPass(payload: Slack.ActionPayload, respond: (message: Slack.InteractiveMessageResponse) => void) {
    console.log("Main player is passing...");
    const metadata = JSON.parse(payload.actions[0].value) as DialogueMetadata;

    const game = await GameController.getGameForId(metadata.gameId);
    if (game == undefined|| game.currentturnidx != metadata.turnIdx||game.currentkeyword != undefined)
        throw new Error("Unknown game");
    if (metadata.playerId != game.currentplayerturn)
        throw new Error("Not the main player but tried to pass");
    
    const nextTurnPlayer = await GameController.pickNextPlayerTurn(game);
    await TurnManager.startNextTurn(game, nextTurnPlayer);
    respond({ delete_original: true });
}

export async function handleMainPlayerDialogueSubmit(payload: Slack.ViewSubmissionPayload): Promise<Slack.InteractiveViewResponse> {
    const metadata = JSON.parse(payload.view.private_metadata) as DialogueMetadata;

    const game = await GameController.getGameForId(metadata.gameId);
    if (game == undefined|| game.currentturnidx != metadata.turnIdx)
        throw new Error("Unknown game");
    if (game.currentkeyword!=undefined)
        throw new Error("Already chosen a card");
    if (metadata.playerId != game.currentplayerturn)
        throw new Error("Not the main player but tried to choose a card");
        
    const chosenCardId = +payload.view.state.values[CHOOSE_MAIN_PLAYER_CARD_BLOCK_ID][CHOOSE_MAIN_PLAYER_CARD_BLOCK_ID+"_menu"].selected_option.value
    const chosenKeyword = payload.view.state.values[CHOOSE_MAIN_PLAYER_KEYWORD_BLOCK_ID][CHOOSE_MAIN_PLAYER_KEYWORD_BLOCK_ID + "_text"].value
    // TODO verify choices

    await TurnManager.mainPlayerChoose(game.id, metadata.playerId, chosenCardId, chosenKeyword);

    return undefined;
}

export async function promptMainPlayerTurn(slackId: string, game: Game, playerId: number, turnIdx: number) {
    return Slack.postEphemeralMessage(game.workspace_id, game.slackchannelid, slackId, getMainPlayerChoosePromptMessage( game.id, playerId, turnIdx));
}

export async function promptOtherPlayerChoose(slackId: string, game: Game) {
    return Slack.postEphemeralMessage(game.workspace_id, game.slackchannelid, slackId, getOtherPlayerChoosePrompt( game.currentturnidx ))
}

export async function handleStartOtherPlayerChoose(payload: Slack.ActionPayload, respond: (message: Slack.InteractiveMessageResponse) => void) {
    const turnIdx = +payload.actions[0].value;
    console.log("Other player is choosing..." + turnIdx);

    const game = await GameController.getGameForSlackChannel(payload.channel.id);
    if (game == undefined || game.currentturnidx != turnIdx )
        throw new Error("Unknown game or this button is from another turn");
    if (game.isreadytovote||game.isvotingcomplete) {
        respond({ response_type: "ephemeral", replace_original: false, text: "We've moved on to voting already. too slow" });
        return;
    }
    
    const player = await PlayerController.getOrCreatePlayerWithSlackId(payload.user.id, game.id);
    if (player == undefined) {
        respond({ response_type: "ephemeral", replace_original: false, text: "You can't join this game" });
        return;
    }
    if (player.id == game.currentplayerturn || player.chosen_gif_id != undefined) {
        respond({ response_type: "ephemeral", replace_original: false, text: "You've already chosen a GIF this turn!" });
        return;
    }
    
    const cards = await GifController.dealCardsToPlayer(game.id, player.id);
    const mainplayer = await PlayerController.getPlayerWithId(game.currentplayerturn);

    const modal = getOtherPlayerChooseDialogue(cards, game.currentkeyword, mainplayer.slack_user_id, game.id, player.id, game.currentturnidx, player.last_refresh_on_turn < game.currentturnidx);
    try {
        await Slack.showModal(game.workspace_id, payload.trigger_id, modal);
    }
    catch(e) {
        respond({ response_type: "ephemeral", replace_original: false, text: `Something went wrong with Slack. (${e}) Try again?` });
    }

    // TODO delete message if modal is cancelled
    // respond({ delete_original: true });
}

export async function handleOtherPlayerDialogueSubmit(payload: Slack.ViewSubmissionPayload): Promise<Slack.InteractiveViewResponse> {
    const metadata = JSON.parse(payload.view.private_metadata) as DialogueMetadata;
    console.log("Player chose..." + metadata.playerId);

    const game = await GameController.getGameForId(metadata.gameId);
    if (game == undefined|| game.currentturnidx != metadata.turnIdx)
        throw new Error("Unknown game");
    if (game.isreadytovote||game.isvotingcomplete) {
        throw new Error("We've moved on to voting already. too slow" );
    }
    console.log("checking player turn");
    if (metadata.playerId == game.currentplayerturn)
        throw new Error("The main player but tried to choose a card");
    console.log("checking player turn");

    const player = await PlayerController.getPlayerWithId(metadata.playerId);
    if (player.chosen_gif_id != undefined) {
        throw new Error("You've already chosen a GIF this turn");
    }
    
    console.log(JSON.stringify(payload.view));
    const chosenCardId = +payload.view.state.values[CHOOSE_OTHER_PLAYER_CARD_BLOCK_ID][CHOOSE_OTHER_PLAYER_CARD_BLOCK_ID + "_menu"].selected_option.value
    // TODO verify choices



    await TurnManager.otherPlayerChoose(game, metadata.playerId, chosenCardId);
    await Slack.postEphemeralMessage(game.workspace_id, game.slackchannelid, player.slack_user_id, { text: "👌 GIF PICKED" });

    return undefined;
}

export async function handleMainPlayerRedealAction(payload: Slack.ActionPayload, respond: (message: Slack.InteractiveMessageResponse) => void) {
    console.log("Redealing main player cards the other players");
    console.log(JSON.stringify(payload));

    const metadata = JSON.parse(payload.view.private_metadata) as DialogueMetadata;
    const game = await GameController.getGameForId(metadata.gameId)
    if (game == undefined || game.currentturnidx != metadata.turnIdx) {
        throw Error("This game doesn't exit");
    }

    const player = await PlayerController.getPlayerWithId(metadata.playerId);
    if (player.last_refresh_on_turn >= game.currentturnidx) {
        throw Error("This game doesn't exit or this has already been skipped");        
    }

    const newGifs = await GifController.redealCardsToPlayer(game.id, player.id, game.currentturnidx);

    const modal = getMainPlayerChooseDialogue(newGifs, game.id, metadata.playerId, game.currentturnidx, false );
    console.log("modal refreshed: " + JSON.stringify(modal));
    await Slack.updateModal(game.workspace_id, payload.container.view_id, modal);
}

export async function handleOtherPlayerRedealAction(payload: Slack.ActionPayload, respond: (message: Slack.InteractiveMessageResponse) => void) {
    console.log("Redealing other player cards");
    console.log(JSON.stringify(payload));

    const metadata = JSON.parse(payload.view.private_metadata) as DialogueMetadata;
    const game = await GameController.getGameForId(metadata.gameId)
    if (game == undefined || game.currentturnidx != metadata.turnIdx) {
        throw Error("This game doesn't exit");
    }

    const player = await PlayerController.getPlayerWithId(metadata.playerId);
    if (player.last_refresh_on_turn >= game.currentturnidx) {
        throw Error("This game doesn't exit or this has already been skipped");        
    }

    const newGifs = await GifController.redealCardsToPlayer(game.id, player.id, game.currentturnidx);
    const mainPlayer = await PlayerController.getPlayerWithId(game.currentplayerturn);
    const modal = getOtherPlayerChooseDialogue(newGifs, game.currentkeyword, mainPlayer.slack_user_id, game.id, player.id, game.currentturnidx, false );
    
    await Slack.updateModal(game.workspace_id, payload.container.view_id, modal);
}