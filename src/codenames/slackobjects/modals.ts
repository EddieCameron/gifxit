import * as Slack from '../../slack'
import GameGif from '../models/gamegif'
import { View, Option } from '@slack/web-api'
import { getBigGifSections, getSmallGifSection } from './messages';

export const CHOOSE_PROMPT_DIALOGUE_SUBMIT_CALLBACK_ID = "choose_prompt_submit";
export const CHOOSE_PROMPT_KEYWORD_BLOCK_ID = "choose_prompt_keyword_textfield";
export async function showChoosePromptModal(workspace: string, triggerid: string, turnid: number, gifs: GameGif[]) {
    const message: View = {
        type: "modal",
        callback_id: CHOOSE_PROMPT_DIALOGUE_SUBMIT_CALLBACK_ID,
        private_metadata: turnid.toString(),
        title: {
            "type": "plain_text",
            "text": "📝 Choose your Hint 📝",
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
                text: "The decoy gifs..."
            }
        }]
    };

    // the other gifs
    for (const gamegif of gifs) {
        if (!gamegif.is_target) {
            message.blocks.push(getSmallGifSection(gamegif.url));
        }
    }


    // what's in your hand
    message.blocks.push({
        type: "section",
        text: {
            type: "mrkdwn",
            text: "...and here are your hint gifs 🤐"
        }
    })
    let optionIdx = 1;
    for (const gamegif of gifs) {
        if (gamegif.is_target) {
            const sections = getBigGifSections(gamegif.url, optionIdx);
            message.blocks = message.blocks.concat(sections);
            message.blocks.push({ type: "divider" });
            
            optionIdx++;
        }
    }

    // keyword entry
    message.blocks.push({
        block_id: CHOOSE_PROMPT_KEYWORD_BLOCK_ID,
        type: "input",
        "label": {
            "type": "plain_text",
            "text": "Write a hint that will help the other players guess as many as your target gifs as possible",
            "emoji": true
        },
        "hint": {
            "type": "plain_text",
            "text": "Careful, if they choose the wrong gif, your turn is over!",
            "emoji": true
        },
        "element": {
            "type": "plain_text_input",
            "action_id": CHOOSE_PROMPT_KEYWORD_BLOCK_ID + "_text",
            min_length: 3,
            max_length: 144
        }
    });

    // show modal
    return Slack.showModal(workspace, triggerid, message);
}