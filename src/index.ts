import express = require( "express" );
import * as Slack from "./slack"
import * as SlackActions from "./slackactions"

const app: express.Application = express();

Slack.init(app);
SlackActions.init();

app.listen(process.env.PORT);