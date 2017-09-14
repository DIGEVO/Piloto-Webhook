'use strict';

const Swagger = require('swagger-client');
const rp = require('request-promise');
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 1800 });

require('dotenv').config();

const dashbotApiMap = {
    'facebook': process.env.DASHBOT_API_KEY_GENERIC,
    'webchat': process.env.DASHBOT_API_KEY_GENERIC,
    'skype': process.env.DASHBOT_API_KEY_GENERIC,
    'emulator': process.env.DASHBOT_API_KEY_GENERIC,
};

const dashbot = require('dashbot')(dashbotApiMap).generic;

var watermark = null;
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
                console.log(`enviando: ${message}`);
                dashbot.logOutgoing({ text: message, timestamp: Date.now() });
            })
            .catch((err) => console.error('Error sending message:', err));
    },

    pollMessages(client, conversationId) {
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
    },

    connectBot: async (message, response) => {
        const directLineClient = await module.exports.createClient();
        const result = await directLineClient.Conversations.Conversations_StartConversation();
        const conversationId = result.obj.conversationId;
        await module.exports.sendMessagesFromDashbot(directLineClient, conversationId, message);
        await module.exports.logIncommingMessage(directLineClient, conversationId);
        response.end();
    },

    logIncommingMessage: async (directLineClient, conversationId) => {
        let activitiesResponse;
        while (!activitiesResponse
            || !activitiesResponse.obj.activities
            || !activitiesResponse.obj.activities.length
            || !activitiesResponse.obj.activities.some(m => m.from.id !== process.env.CLIENT)) {
            activitiesResponse = await directLineClient.Conversations
                .Conversations_GetActivities({ conversationId: conversationId, watermark: watermark });
        }

        const status = activitiesResponse.obj.activities
            .filter(m => m.from.id !== process.env.CLIENT)
            .reduce((acc, a) => acc.concat(module.exports.getActivityText(a)), '');

        console.log(`recibiendo: ${status}`);
        dashbot.logIncoming({
            text: status,
            timestamp: Date.now()
        });
    },

    getActivityText: (activity) => activity.text ? `${activity.text}\n` : ''
};