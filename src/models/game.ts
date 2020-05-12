export default interface Game {
    id: number;
    slackchannelid: string;

    currentplayerturn: number;
    currentturnidx: number;
    currentkeyword: string;

    isreadytovote: boolean;
    isvotingcomplete: boolean;

    lastchosesummarymessage: string;
    lastvotesummarymessage: string;

    choose_end_time: Date;
}