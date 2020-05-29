import * as Slack from '../../slack'
import Gif from '../../models/gif'
import { getEmojiForNumber, bellGifs, getFixedHeightUrl } from '../../utilities';
import { KnownBlock, SectionBlock } from '@slack/web-api';
import GameTurn from '../models/gameturn';
import GameGif from '../models/gamegif';

export function getSmallGifSection(gifurl: string, handNumber?: number) {
    return {
        "type": "section",
        "text": {
            "type": "mrkdwn",
            "text": handNumber == undefined ? " " : getEmojiForNumber(handNumber)
        },
        "accessory": {
            "type": "image",
            "image_url": gifurl,
            "alt_text": "Gif " + (handNumber == undefined ? "" : handNumber.toString())
        }
    };
}

export function getBigGifSections(gifurl: string, handNumber?: number) {
    const blocks: KnownBlock[] = [];
    if (handNumber != undefined) {
        blocks.push({
            type: "section",
            text: {
                type: "plain_text",
                text: getEmojiForNumber(handNumber),
                emoji: true
            }
        });
    }

    blocks.push(
        {
            type: "image",
            image_url: gifurl,
            alt_text: "Gif " + (handNumber == undefined ? "" : handNumber.toString())
        }
    );
    return blocks;
}

export async function showNewTurnMessage(workspace: string, channel: string, playerSlackId: string ) {
    return Slack.postMessage(workspace, channel, {
        text: `It's <@${playerSlackId}>'s turn!`
    })
}

export const CHOOSE_PROMPT_CALLBACK_ID = "choose_prompt";
export async function showChoosePromptMessage(workspace: string, channel: string, playerSlackId: string ) {
    return Slack.postEphemeralMessage(workspace, channel, playerSlackId, {
        text: `It's your turn to pick a prompt!`,
        blocks: [
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `It's your turn to pick a prompt!`,
                },
                accessory: {
                    type: "button",
                    text: {
                        type: "plain_text",
                        text: "Choose Prompt",
                    },
                    action_id: CHOOSE_PROMPT_CALLBACK_ID
                }
            }
        ]
    })
}

export async function showHintChosenMessage(workspace: string, channel: string, playerSlackId: string) {
    const message: Slack.Message = {
        text: 'New Round',
        blocks: [
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `🛎 <!here> New Round! 🛎`
                }
            },
            {
                type: "image",
                image_url: bellGifs[Math.floor(Math.random() * bellGifs.length)],
                alt_text: `:bell:`
            }
            ,
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `<@${playerSlackId}> has chosen a GIF!`
                }
            }
        ]
    }

    return Slack.postMessage(workspace, channel, message);
}

export const LOCK_IN_GIF_CALLBACK_ID = "lock_in_gif";
function getGifOptionSections(gif: GameGif): KnownBlock[] {
    return [
        {
            type: "image",
            image_url: getFixedHeightUrl( gif.url ),
            alt_text: "A gif"
        },
        {
            type: "section",
            text: {
                type: "mrkdwn",
                text: "Is this one of the hinted Gifs? Make sure eveyone agrees before choosing! If it's wrong the turn is over"
            },
            accessory: {
                type: "button",
                text: {
                    type: "plain_text",
                    text: "Lock it in!"
                },
                value: gif.id.toString(),
                action_id: LOCK_IN_GIF_CALLBACK_ID
            }
        }
    ]
}

function getCorrectGifSection(gif: GameGif): KnownBlock[] {
    return [
        {
            type: "image",
            image_url: getFixedHeightUrl( gif.url ),
            alt_text: "A gif"
        },
        {
            type: "section",
            text: {
                type: "mrkdwn",
                text: "✅ ✅ ✅ ✅ ✅"
            }
        }
    ]
}

function getInCorrectGifSection(gif: GameGif): KnownBlock[] {
    return [
        {
            type: "image",
            image_url: getFixedHeightUrl( gif.url ),
            alt_text: "A gif"
        },
        {
            type: "section",
            text: {
                type: "mrkdwn",
                text: "❌ ❌ ❌ ❌ ❌"
            }
        }
    ]
}


export function getGifOptionsMessage(turn: GameTurn, gifs: GameGif[]) {
    const lockedInGifs = [];
    if (turn.chosen_a_gif_id) {
        lockedInGifs.push(turn.chosen_a_gif_id);
        if (turn.chosen_b_gif_id) {
            lockedInGifs.push(turn.chosen_b_gif_id);
            if (turn.chosen_c_gif_id) {
                lockedInGifs.push(turn.chosen_c_gif_id);
                if (turn.chosen_d_gif_id) {
                    lockedInGifs.push(turn.chosen_d_gif_id);
                }
            }
        }
    }

    const message: Slack.Message = {
        text: 'Choose your GIFs',
        blocks: [
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `Here are your Gifs for this round`
                }
            },
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `Your hint is *${turn.current_keyword}*`
                }
            },
        ]
    }

    for (const gif of gifs) {
        const isLockedIn = lockedInGifs != undefined && lockedInGifs.some(g => g == gif.id);
        if (isLockedIn && gif.is_target)
            message.blocks = message.blocks.concat(getCorrectGifSection(gif))
        else if (isLockedIn && !gif.is_target)
            message.blocks = message.blocks.concat(getInCorrectGifSection(gif))
        else
            message.blocks = message.blocks.concat(getGifOptionSections(gif))
        message.blocks.push({ type: "divider" });
    }

    return message;
}

export async function postGifOptionsMessage(workspace: string, channel: string, turn: GameTurn, gifs: GameGif[]) {
    return Slack.postMessage(workspace, channel, getGifOptionsMessage( turn, gifs ) );
}

export async function postChoseCorrectlyMessage(workspace: string, channel: string, chosenGif: GameGif) {
    return Slack.postMessage(workspace, channel, {
        text: `You were right!`,
        blocks: [
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: "🎉 You were right! This was one of the target Gifs!"
                },
                accessory: {
                    type: "image",
                    image_url: chosenGif.url,
                    alt_text: "Gif"
                }
            }
        ]
    })
}

        
export async function postYouDidItMessage(workspace: string, channel: string, mainPlayerSlackId: string, hint: string) {
    return Slack.postMessage(workspace, channel, {
        text: `You got them all!`,
        blocks: [
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `🎉 You found all of <@${mainPlayerSlackId}>'s *${hint}* Gifs! Good Job 🕵️‍♀️`
                }
            }
        ]
    })
}

export async function postYouFuckedItMessage(workspace: string, channel: string) {
    return Slack.postMessage(workspace, channel, {
        text: `Oh...no...you fucked up`,
        blocks: [
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `Oh...no...you fucked up. That wasn't even close to being the right Gif`
                }
            }
        ]
    })
}