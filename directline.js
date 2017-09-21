'use strict';

const Swagger = require('swagger-client');
const rp = require('request-promise');
const dashbotwrap = require('./dashbotwrapper');

require('dotenv').config();

var watermark = null;
module.exports = {

    createClient: () => {
        return rp(process.env.SPEC)
            .then(spec => new Swagger({ spec: JSON.parse(spec.trim()), usePromise: true }))
            .then(client => {
                client.clientAuthorizations.add('AuthorizationBotConnector',
                    new Swagger.ApiKeyAuthorization('Authorization', 'Bearer ' + process.env.SECRET, 'header'));
                return client;
            })
            .catch((err) => console.error('Error initializing DirectLine client', err));
    },

    connectBot: async (message) => {
        const directLineClient = await module.exports.createClient();
        const result = await directLineClient.Conversations.Conversations_StartConversation();
        const conversationId = result.obj.conversationId;
        await module.exports.sendMessagesFromDashbot(directLineClient, conversationId, message);
        await module.exports.receiveMessageFromBot(directLineClient, conversationId, message);
    },

    sendMessagesFromDashbot(client, conversationId, body) {
        const message = JSON.stringify(body);
        client.Conversations
            .Conversations_PostActivity(module.exports.postActivity(conversationId, message))
            .then(() => dashbotwrap.logMessage(module.exports.getTextFromBody(body), body, conversationId, false))
            .catch((err) => console.error('Error sending message:', err));
    },

    receiveMessageFromBot: async (directLineClient, conversationId, message) => {
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

        dashbotwrap.logMessage(status || 'Empty message', message, conversationId);
    },

    postActivity(conversationId, message) {
        return {
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
        };
    },

    getTextFromBody: (body) => {
        let text = body.text || '';
        text = text.trim() || 'Empty message';
        const pauseMsg = body.paused ? 'Paused Bot' : 'Unpaused Bot';

        return body.url === '/pause' ? pauseMsg : text;
    },

    getActivityText: (activity) => activity.text ? `${activity.text}\n` : ''
};
