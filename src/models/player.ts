export default interface Player {
    id: number;
    slack_user_id: string;
    slack_name: string;

    game_id: number;

    chosen_gif_id: number;
    voted_gif_id: number;
    score: number;

    last_refresh_on_turn: number;
}