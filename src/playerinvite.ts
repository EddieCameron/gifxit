import Game from "./models/game";
import * as Slack from "./slack"

export const ACCEPT_INVITE_CALLBACK = "accept_invite_callback";
function getTnviteMessage(inviterSlackId: string, channelSlackId: string, gameId: number) {
    return {
        text: `<@${inviterSlackId}> has invited you to join a game of Gifxit in <#${channelSlackId}>`,
        blocks: [{
            type: "section",
            text: {
                type: "mrkdwn",
                text: `<@${inviterSlackId}> has invited you to join a game of Gifxit in <#${channelSlackId}>`
            },
            accessory: {
                action_id: ACCEPT_INVITE_CALLBACK,
                type: "button",
                text: {
                    type: "plain_text",
                    text: "Accept"
                },
                value: gameId.toString()
            }
        }
        ]
    } as Slack.Message;
}

export async function invitePlayer( game: Game, inviteeSlackId: string, inviterSlackId: string) {
    const message = getTnviteMessage(inviterSlackId, game.slackchannelid, game.id);

    return Slack.sendPm(inviteeSlackId, message);
}
