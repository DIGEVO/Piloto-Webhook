'use strict';

require('dotenv').config();

const directline = require('./directline');

module.exports = {
    handleError(err) {
        console.error(err);
    },

    handleRequest(request, response) {
        if (request.method === 'POST' &&
            (request.url === '/pause' || request.url === '/message')
        ) {
            const { headers, method, url } = request;
            let body = [];
            request
                .on('error', module.exports.handleError)
                .on('data', (chunk) => body.push(chunk))
                .on('end', () => { module.exports.handleResponse(Buffer.concat(body).toString(), response)});
        } else {
            response.statusCode = 404;
            response.end();
        }
    },

    handleResponse: (strBody, response) => {
        const body = JSON.parse(strBody === '' ? '{}' : strBody);

        response.on('error', module.exports.handleError);
        response.writeHead(200, { 'Content-Type': 'application/json' });

        body.paused = body.paused || false;
        body.userId = body.userId || null;
        body.conversationId = body.conversationId || null;
        body.text = body.text || null;
        body.apiKey = body.apiKey || null;

        module.exports.connectBot(JSON.stringify({ body: JSON.stringify(body) }), response);
    },

    connectBot: (message, response) => {
        const directLineClient = directline.createClient();
        directLineClient
            .then((client) => {
                client.Conversations.Conversations_StartConversation()
                    .then((response) => response.obj.conversationId)
                    .then((conversationId) => {
                        directline.sendMessagesFromDashbot(client, conversationId, message);
                        directline.pollMessages(client, conversationId);
                    });
            })
            .then(() => response.end());
    },
};
