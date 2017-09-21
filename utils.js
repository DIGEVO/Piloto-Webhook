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
                .on('end', () => module.exports.handleResponse(Buffer.concat(body).toString(), response, url));
        } else {
            response.statusCode = 200;
            response.end();
        }
    },

    handleResponse: (strBody, response, url) => {
        const body = JSON.parse(strBody === '' ? '{}' : strBody);

        response.on('error', module.exports.handleError);

        body.paused = body.paused || true;
        body.userId = body.userId || null;
        body.conversationId = body.conversationId || null;
        body.text = body.text || null;
        body.apiKey = body.apiKey || null;
        body.url = url;

        directline.connectBot(body);

        response.statusCode = 200;
        response.end();
    }
};
