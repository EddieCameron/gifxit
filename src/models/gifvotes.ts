import Gif from "./gif";
import Player from "./player";

export default interface GifVote {
    gif: Gif;
    chosenByPlayer: Player;
    votes: Player[];
}