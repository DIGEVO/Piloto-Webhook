'use strict';

var Swagger = require('swagger-client');
var rp = require('request-promise');
const Promise = require('promise');

require('dotenv').config();

const dashbotApiMap = {
    'facebook': process.env.DASHBOT_API_KEY_GENERIC,
    'webchat': process.env.DASHBOT_API_KEY_GENERIC,
    'skype': process.env.DASHBOT_API_KEY_GENERIC,
    'emulator': process.env.DASHBOT_API_KEY_GENERIC,
};

const dashbot = require('dashbot')(dashbotApiMap).generic;

module.exports = {
    createClient: () => {
        return rp(process.env.SPEC)
            .then((spec) => {
                return new Swagger({
                    spec: JSON.parse(spec.trim()),
                    usePromise: true
                });
            })
            .then((client) => {
                client.clientAuthorizations.add('AuthorizationBotConnector',
                    new Swagger.ApiKeyAuthorization('Authorization', 'Bearer ' + process.env.SECRET, 'header'));
                return client;
            })
            .catch((err) => console.error('Error initializing DirectLine client', err));
    },

    logIncommingMessages(activities) {
        if (activities && activities.length) {
            activities = activities.filter((m) => { return m.from.id !== process.env.CLIENT });

            if (activities.length) {
                activities.forEach(module.exports.logIncommingMessage);
            }
        }
    },

    logIncommingMessage(activity) {
        console.log(JSON.stringify(activity ? activity : {}));
        dashbot.logIncoming({
            text: JSON.stringify(activity ? activity : {}),
            timestamp: Date.now()
        });
    },

    sendMessagesFromDashbot(client, conversationId, message) {
        client.Conversations
            .Conversations_PostActivity({
                conversationId: conversationId,
                activity: {
                    textFormat: 'plain',
                    text: message,
                    type: 'message',
                    from: {
                        id: process.env.CLIENT,
                        name: process.env.CLIENT
                    }
                }
            })
            .then(() => { 
                console.log(message);
                dashbot.logOutgoing({ text: message, timestamp: Date.now() });
             })
            .catch((err) => console.error('Error sending message:', err));
    },

    pollMessages(client, conversationId) {
        console.log('Ya estás conectado con el Bot');
        var watermark = null;
        setInterval(() => {
            client.Conversations
                .Conversations_GetActivities({ conversationId: conversationId, watermark: watermark })
                .then((response) => {
                    watermark = response.obj.watermark;
                    return response.obj.activities;
                })
                .then(module.exports.printMessages)
                .catch((error) => console.error(error));
        }, process.env.INTERVAL);
    }
};