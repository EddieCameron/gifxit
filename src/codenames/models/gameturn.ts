export default interface GameTurn {
    id: number;
    game_id: number;

    player_id: number;

    current_keyword: string;

    chosen_a_gif_id: number;
    chosen_b_gif_id: number;
    chosen_c_gif_id: number;
    chosen_d_gif_id: number;
}