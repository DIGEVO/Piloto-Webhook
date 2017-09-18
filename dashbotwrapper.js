'use strict';

require('dotenv').config();

const dashbot = require('dashbot')(process.env.DASHBOT_API_KEY_GENERIC).generic;

module.exports = {
    dashbotMessage(text, body, conversationId) {
        return {
            "text": text,
            "userId": body.userId || process.env.CLIENT,
            "conversationId": body.conversationId || body.userId || process.env.CLIENT,
            "platformJson": {
                "message": body,
                "client": process.env.CLIENT,
                "conversationId": conversationId
            }
        };
    },

    logMessage(text, body, conversationId, incoming = true) {
        module.exports.logFuns[incoming](module.exports.dashbotMessage(text, body, conversationId));
    },
    
    logFuns: {
        true: dashbot.logIncoming,
        false: dashbot.logOutgoing
    }
};