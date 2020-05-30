import express = require( "express" );
import * as Slack from "./slack"
import * as SlackActions from "./slackactions"
import * as SteadyTimer from "./steadytimer/steadytimer"
import { handleChooseTimeUp, handleVoteTimeUp } from "./turnmanager";
import { query } from "./server";
import Gif from "./models/gif";

const app: express.Application = express();
app.use(express.static('public'))


app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

app.get('/picksomegifs', async (req, res) => {
    try {
        const gifs = await query<Gif>(null, "SELECT * FROM gifs ORDER BY RANDOM() LIMIT 10")
        res.json(gifs);
    }
    catch (e) {
        res.status(500).send("oop");
    }
})

Slack.init(app);
SlackActions.init();

app.listen(process.env.PORT);

SteadyTimer.registerEventHandler("chooseTimeUp", handleChooseTimeUp);
SteadyTimer.registerEventHandler("voteTimeUp", handleVoteTimeUp);
SteadyTimer.checkDBTimers();
