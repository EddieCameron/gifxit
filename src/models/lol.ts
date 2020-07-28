import { getBigGifSections } from "src/codenames/slackobjects/messages"

export default interface Lol {
    id: number;
    game: number;
    
    byslackid: string;
    turn: number;
    forplayerid: number;
    forgif: number;
}

/*
CREATE TABLE lols(
    id SERIAL PRIMARY KEY,
    game INTEGER REFERENCES games(id) ON DELETE CASCADE,
    byslackid VARCHAR(100),
    turn INTEGER,
    forplayerid INTEGER REFERENCES players(id) ON DELETE CASCADE,
    forgif INTEGER REFERENCES gifs(id) ON DELETE CASCADE
);
*/