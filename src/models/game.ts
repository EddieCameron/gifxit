export default interface Game {
    id: number;
    slackchannelid: string;

    currentplayerturn: number;
    currentturnidx: number;
    currentkeyword: string;
}