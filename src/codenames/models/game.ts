export default interface Game {
    id: number;
    workspace_id: string;
    slack_channel_id: string;

    current_turn_id: number;
}