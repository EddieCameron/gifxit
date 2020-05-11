import { createEventAdapter } from '@slack/events-api'
import { createMessageAdapter } from '@slack/interactive-messages'
import { WebClient, View, MessageAttachment, KnownBlock, Block, Option, WebAPICallResult } from "@slack/web-api";
import { Application, urlencoded, } from 'express';

import { ViewConstraints, ActionConstraints } from '@slack/interactive-messages/dist/adapter';
import { timeout, TimeoutError } from 'promise-timeout';

const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;

const slackEvents = createEventAdapter(slackSigningSecret);
const slackInteractions = createMessageAdapter(slackSigningSecret);
const slackWeb = new WebClient(process.env.SLACK_WEB_TOKEN);

interface User {
    id: string;
    team_id: string;
    name: string;
    deleted: boolean;
    color: string;
    profile: {
        status_text?: string;
        status_emoji?: string;
        real_name?: string;
        display_name?: string;
        image_original: string;
    };
}

interface ConversationOpenResponse extends WebAPICallResult {
    channel?: {
        id: string;
    };
}

interface ChatPostMessageResult extends WebAPICallResult {
    channel: string;
    ts: string;
    message: Message;
}

interface UserResult extends WebAPICallResult {
    user: User;
}

function getErrorModal(error: Error): View {
    return {
        "type": "modal",
        "title": {
            "type": "plain_text",
            "text": error.name
        },
        "blocks": [
            {
                "type": "section",
                text: {
                    type: "mrkdwn",
                    text: error.message
                }
            }
        ]
    }
}

let slashHandler = async function (payload: SlashPayload): Promise<SlashResponse> {
    return { response_type: "ephemeral", text: "Unknown command" };
}

let messageEventHandler: (event: MessageEvent) => void = undefined;
export function setMessageEventHandler(handler: (event: MessageEvent) => void ) {
    messageEventHandler = handler;
}

export async function postMessage(channel_id: string, message: Message ) {
    return ( await slackWeb.chat.postMessage( {channel: channel_id, text: message.text, blocks: message.blocks }) ) as ChatPostMessageResult;
}

export async function deleteMessage(channelId: string, ts: string) {
    return await slackWeb.chat.delete( {channel: channelId, ts: ts} );
}

export function postEphemeralMessage(channel_id: string, user: string, message: Message ) {
    return slackWeb.chat.postEphemeral( {channel: channel_id, user: user, text: message.text, blocks: message.blocks });
}

export function updateMessage(channel_id: string, ts: string, message: Message) {
    return slackWeb.chat.update({ channel: channel_id, ts: ts, text: message.text, blocks: message.blocks });
}

export async function sendPm(user: string, message: Message) {
    console.log(JSON.stringify(message));
    const response = await slackWeb.conversations.open({ users: user }) as ConversationOpenResponse
    if (!response.ok) {
        throw new Error("Failed to get PM channel: " + response.error );
    }

    return postMessage(response.channel.id, message);
}

export async function getSlackUser(slackUserId: string) {
    return await slackWeb.users.info({ user: slackUserId }) as UserResult;
}

export function addViewSubmissionHandler(constraint: string | ViewConstraints, handler: ViewSubmissionHandler) {
    slackInteractions.viewSubmission(constraint, payload => {
        return handler(payload)
            .catch(e => {
                console.error(e);
                return {
                    response_action: "push",
                    view: getErrorModal(e)
                };
            });
    });
}

export function addActionHandler(constraint: string | ActionConstraints, handler: ActionHandler) {
    slackInteractions.action(constraint, (payload, respond) => {
        return handler(payload, respond)
            .catch(e => {
                console.error(e);
                respond({
                    text: "Something terrible happened:" + e
                });
            });
    });
}

export function setSlashHandler(handler: (payload: SlashPayload) => Promise<SlashResponse>) {
    slashHandler = handler;
}

export async function showModal(trigger_id: string, view: View) {
    return slackWeb.views.open({ trigger_id: trigger_id, view: view });
}

export async function pushModal(trigger_id: string, view: View) {
    return slackWeb.views.push({ trigger_id: trigger_id, view: view });
}

export async function updateModal(view_id: string, view: View) {
    return slackWeb.views.update({ view_id: view_id, view: view });
}

export async function findChannelWithName(channelName: string) {
    const listResponse = await slackWeb.conversations.list();
    console.log(listResponse);
    if (!listResponse.ok)
        throw listResponse.error;
    
    const channels = listResponse.channels as [any];
    return channels.find(c => c.name == channelName);
}

export async function createChannelWithName( name: string, isPrivate = false ) {
    const createResponse = await slackWeb.conversations.create({ name: name, is_private: isPrivate });
    console.log(createResponse);
    if (!createResponse.ok)
        throw createResponse.error;

    return createResponse.channel as any;
}

export interface Message {
    text?: string;
    blocks?: (KnownBlock | Block)[];
}

export interface InteractiveMessageResponse {
    response_type?: "ephemeral";
    replace_original?: boolean;
    delete_original?: boolean;
    text?: string;
    attachments?: MessageAttachment[];
    blocks?: (KnownBlock | Block)[];
    icon_emoji?: string;
    icon_url?: string;
    link_names?: boolean;
    mrkdwn?: boolean;
    parse?: 'full' | 'none';
    reply_broadcast?: boolean;
    thread_ts?: string;
    unfurl_links?: boolean;
    unfurl_media?: boolean;
    username?: string;
}

export interface InteractiveViewResponse {
    response_action?: "update" | "push" | "clear" | "errors";
    view?: View;
    errors?: {
        [block_id: string]: string;
    };
}

export interface ViewSubmissionPayload {
    type: 'view_submission';
    trigger_id: string;
    view: {
        callback_id: string;
        private_metadata: string;
        external_id: string;
        state: {
            values: {
                [block_id: string]: {
                    [action_id: string]: {
                        type: string;
                        value?: string;
                        selected_option?: {
                            value: string;
                        };
                    };
                };
            };
        };
    };
}

interface ViewSubmissionHandler {
    (payload: ViewSubmissionPayload, respond?: (response: InteractiveMessageResponse) => void ): Promise<InteractiveViewResponse|undefined>;
}

interface ViewClosedPayload {
    type: 'view_closed';
    view: View;
    is_cleared: boolean;
}

export interface ActionPayload {
    type: 'block_actions';
    trigger_id: string;
    user: {
        id: string;
        username: string;
        name: string;
        team_id: string;
    };
    message?: {
        text?: string;
        blocks?: (KnownBlock | Block)[];
        ts: string;
    };
    container?: {
        type: string;
        view_id?: string;
    };
    view?: View;
    channel?: {
        id: string;
        name: string;
    };
    actions: [
        {
            action_id: string;
            block_id: string;
            value?: string;
            selected_option?: Option;
            selected_user?: string;
        }
    ];
}

declare type ActionHandler = (payload: any, respond: (response: InteractiveMessageResponse) => void) => Promise<void>

export interface SlashPayload {
    command: string;
    text?: string;
    response_url: string;
    trigger_id: string;
    user_id: string;
    team_id: string;
    channel_id: string;
}

export interface SlashResponse {
    response_type: "ephemeral" | "in_channel";
    text?: string;
    attachments?: MessageAttachment[];
    blocks?: (KnownBlock | Block)[];
    icon_emoji?: string;
    icon_url?: string;
    link_names?: boolean;
    mrkdwn?: boolean;
    parse?: 'full' | 'none';
    reply_broadcast?: boolean;
    thread_ts?: string;
    unfurl_links?: boolean;
    unfurl_media?: boolean;
    username?: string;
}

export interface EventWrapper {
    type: string;
    event_ts: string;
    user: string;
}

export interface MessageEvent extends EventWrapper {
    channel: string;
    text: string;
    ts: string;
}

export const OK_RESPONSE_CALLBACK_ID = "ok";

export function init(app: Application) {
    // events
    app.use('/slack/events', slackEvents.requestListener());

    slackEvents.on('message', (event) => {
        console.log(`message received ${JSON.stringify( event )}`);
        if (messageEventHandler != undefined) {
            messageEventHandler(event as MessageEvent);
        }
    });

    slackEvents.on('error', console.error);

    // interactive
    app.use('/slack/interactive', slackInteractions.requestListener());
    slackInteractions.action(OK_RESPONSE_CALLBACK_ID, () => undefined );

    // slash commands
    app.post('/slash', urlencoded({ extended: false }), function (req, res) {
        console.log( "got slash" )
        timeout(slashHandler(req.body), 2000)
            .then(r => {
                if (r === undefined)
                    res.status(200).end();
                
                console.log(r);
                res.json(r);
            })
            .catch(e => {
                if (e instanceof TimeoutError) {
                    // still waiting, need to tell player
                    res.json({ response_type: "ephemeral", text: "something took too long..." });
                }
                else {
                    res.json({ response_type: "ephemeral", text: `something broke ${e}` });
                }
            });
    });

    console.log("Slack init complete");
}