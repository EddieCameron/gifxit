export default interface Game {
    id: number;
    workspace_id: string;
    slackchannelid: string;

    currentplayerturn: number;
    currentturnidx: number;
    currentkeyword: string;

    isreadytovote: boolean;
    isvotingcomplete: boolean;

    lastturnpromptmessage: string;
    lastchosesummarymessage: string;
    lastvotesummarymessage: string;

    choose_end_time: Date;
    vote_end_time: Date;
}