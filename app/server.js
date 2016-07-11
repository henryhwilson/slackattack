// example bot
import botkit from 'botkit';
import Yelp from 'yelp';

const yelp = new Yelp({
  consumer_key: process.env.YELP_CONSUMER_KEY,
  consumer_secret: process.env.YELP_CONSUMER_SECRET,
  token: process.env.YELP_TOKEN,
  token_secret: process.env.YELP_TOKEN_SECRET,
});

console.log('starting bot');

// botkit controller
const controller = botkit.slackbot({
  debug: false,
});

// initialize slackbot
const slackbot = controller.spawn({
  token: process.env.SLACK_BOT_TOKEN,
  // this grabs the slack token we exported earlier
}).startRTM(err => {
  // start the real time message client
  if (err) { throw new Error(err); }
});

// prepare webhook
// for now we won't use this but feel free to look up slack webhooks
controller.setupWebserver(process.env.PORT || 3001, (err, webserver) => {
  controller.createWebhookEndpoints(webserver, slackbot, () => {
    if (err) { throw new Error(err); }
  });
});

// example hello response
controller.hears(['hey', 'hello', 'hi', 'howdy'], ['direct_message', 'direct_mention', 'mention'], (bot, message) => {
  bot.api.users.info({ user: message.user }, (err, res) => {
    if (res) {
      bot.reply(message, `Hello, ${res.user.profile.first_name}!`);
    } else {
      bot.reply(message, 'Hello there!');
    }
  });
});

// yelp
controller.hears(['food', 'hungry', 'breakfast', 'lunch', 'dinner'], ['direct_message', 'direct_mention', 'mention'], (bot, message) => {
  const findFood = (type, location, convo) => {
    convo.say(`Looking for ${type.text} in ${location.text}...`);
    convo.next();

    yelp.search({ term: type.text, location: location.text, limit: 2 })
    .then((data) => {
      console.log(`Found ${data.total} results`);
      console.log(data);
      if (data.total < 1) {
        convo.say('I did not find any results :(');
        convo.next();
      } else {
        data.businesses.forEach(business => {
          const pretext = `rating: ${business.rating}`;
          const result = {
            username: 'henry-bot',
            text: pretext,
            attachments: [
              {
                unfurl_links: true,
                fallback: business.snippet_text,
                title: `${business.name}`,
                title_link: `${business.url}`,
                text: business.snippet_text,
                image_url: business.image_url,
                color: '#7CD197',
              },
            ],
          };
          convo.say(result);
          convo.next();
        });
      }
    })
    .catch((err) => {
      console.log('Error');
      console.error(err);
      convo.say('Uh oh! I could not connect to Yelp...');
      convo.next();
    });
  };

  const askLocation = (type, convo) => {
    convo.ask('Where are you?', (location, convo2) => {
      findFood(type, location, convo2);
    });
    convo.next();
  };

  const askFood = (response, convo) => {
    convo.ask('What kind of food are you in the mood for?', (foodType, convo2) => {
      askLocation(foodType, convo2);
    });
    convo.next();
  };

  const askYesOrNo = (response, convo) => {
    convo.ask('Would you like food recommendations nearby?', [{
      pattern: bot.utterances.yes,
      callback: (response2, convo2) => {
        askFood(response2, convo2);
      },
    }, {
      pattern: bot.utterances.no,
      callback: (response2, convo2) => {
        convo2.say('Okay! Don\'t go hungry!');
        convo2.next();
      },
    }, {
      default: true,
      callback: (response2, convo2) => {
        convo2.repeat();
        convo2.next();
      },
    },
    ]);
    convo.next();
  };

  bot.startConversation(message, askYesOrNo);
});

// yelp
controller.hears(['game'], ['direct_message', 'direct_mention', 'mention'], (bot, message) => {
  let numTries = 0;
  const continueGame = (response, convo) => {
    numTries++;
    const hint = numTries > 2 ? 'Guess again! Hint: It rhymes with "shoe"' : 'Guess again!';
    convo.ask(hint, (color, convo2) => {
      if (color.text.toLowerCase() === 'blue') {
        // URL to image of trophy: https://pixabay.com/static/uploads/photo/2013/07/12/18/29/trophy-153395_960_720.png
        const msg = {
          username: 'henry-bot',
          text: 'You win! Thanks for playing with me :-)',
          attachments: [
            {
              unfurl_links: true,
              fallback: 'Cool pic of a trophy',
              image_url: 'https://pixabay.com/static/uploads/photo/2013/07/12/18/29/trophy-153395_960_720.png',
              color: '#7CD197',
            },
          ],
        };
        convo.say(msg);
        convo.next();
      } else {
        continueGame(response, convo2);
      }
    });
    convo.next();
  };

  const startGame = (response, convo) => {
    numTries = 0;
    convo.ask('Guess my favorite color.', (color, convo2) => {
      if (color.text.toLowerCase() === 'blue') {
        convo.say('You won on the first try! Either you\'re very smart, or you looked at my code ;)');
        convo.next();
      } else {
        continueGame(response, convo2);
      }
    });
    convo.next();
  };

  const askYesOrNo = (response, convo) => {
    convo.ask('Would you like to play a game?', [{
      pattern: bot.utterances.yes,
      callback: (response2, convo2) => {
        startGame(response2, convo2);
      },
    }, {
      pattern: bot.utterances.no,
      callback: (response2, convo2) => {
        convo2.say('Okay! Don\'t get too bored!');
        convo2.next();
      },
    }, {
      default: true,
      callback: (response2, convo2) => {
        convo2.repeat();
        convo2.next();
      },
    },
    ]);
    convo.next();
  };

  bot.startConversation(message, askYesOrNo);
});

controller.hears(['what', 'where', 'why', 'how'], ['direct_message', 'direct_mention', 'mention'], (bot, message) => {
  bot.reply(message, 'That is a great question... I am stumped! Maybe my cousin Siri knows?');
});

controller.on('outgoing_webhook', (bot, message) => {
  bot.replyPublic(message, '**Yawn**');
});

controller.hears(['help'], ['direct_message', 'direct_mention', 'mention'], (bot, message) => {
  bot.reply(message, 'I can help you find restaurants (type "food") or play a game (type "game")!');
});

controller.hears([''], ['direct_message', 'direct_mention', 'mention'], (bot, message) => {
  bot.reply(message, 'I am practicing my English! Stop bothering me... But let me know if you are hungry.');
});
