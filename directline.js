'use strict';

const Swagger = require('swagger-client');
const rp = require('request-promise');

require('dotenv').config();

const dashbot = require('dashbot')(process.env.DASHBOT_API_KEY_GENERIC).generic;

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

    sendMessagesFromDashbot(client, conversationId, body) {
        const message = JSON.stringify({ body: JSON.stringify(body) });
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
                dashbot.logOutgoing({
                    "text": message,
                    "userId": process.env.CLIENT,
                    "conversationId": process.env.CLIENT,
                    "platformJson": {}
                });
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

    connectBot: async (message) => {
        const directLineClient = await module.exports.createClient();
        const result = await directLineClient.Conversations.Conversations_StartConversation();
        const conversationId = result.obj.conversationId;
        await module.exports.sendMessagesFromDashbot(directLineClient, conversationId, message);
        await module.exports.logIncommingMessage(directLineClient, conversationId, message);
    },

    logIncommingMessage: async (directLineClient, conversationId, message) => {
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
            "text": status,
            "userId": process.env.CLIENT,
            "conversationId": process.env.CLIENT,
            "platformJson": {}
        });
    },

    getActivityText: (activity) => activity.text ? `${activity.text}\n` : ''
};