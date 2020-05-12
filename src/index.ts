import express = require( "express" );
import * as Slack from "./slack"
import * as SlackActions from "./slackactions"
import * as SteadyTimer from "./steadytimer/steadytimer"
import { handleChooseTimeUp } from "./turnmanager";

const app: express.Application = express();

Slack.init(app);
SlackActions.init();

app.listen(process.env.PORT);

SteadyTimer.registerEventHandler("chooseTimeUp", handleChooseTimeUp);
SteadyTimer.checkDBTimers();
