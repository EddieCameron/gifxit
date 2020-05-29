import Player from "./player";
import GameGif from "./gamegif";

export default interface GifVote {
    gif: GameGif;
    votes: Player[];
}