'use strict';
const https = require('https');
const querystring = require('querystring');
const agent = new https.Agent({ keepAlive: true, maxSockets: 30 });
const timeout = 5 * 1000;

exports.send = (opt) => {
    return new Promise((fulfill, reject) => {
        const request = http.get({
            host: opt.host
            , path: `${opt.path}?${querystring.stringify(opt.qs)}`
            , agent: agent
        });

        request.setTimeout(timeout, () => {
            request.abort();
            return reject({
                lv: 'ERROR'
                , message: 'http timeout'
                , result: { status: 801, description: 'http timeout', data: null }
            });
        });

        request.on('error', (err) => reject({
            lv: 'ERROR'
            , message: err.message || err
            , result: { status: 802, description: 'http error', data: null }
        }));

        request.on('response', (res) => {
            if (res.statusCode !== 200) return reject({
                lv: 'ERROR'
                , message: `http response ${res.statusCode}`
                , result: { status: 803, description: `http response ${res.statusCode}`, data: null }
            });

            let count = 0, chunks = [];
            res.on('data', (chunk) => {
                chunks.push(chunk);
                count += chunk.length;
            });

            res.on('end', () => {
                try {
                    return fulfill(JSON.parse(Buffer.concat(chunks, count).toString('utf8')));
                }
                catch (err) {
                    console.log(Buffer.concat(chunks, count).toString('utf8'));
                    return reject({
                        lv: 'ERROR'
                        , message: 'http response format error'
                        , result: { status: 804, description: 'http result format error', data: null }
                    });
                }
            });
        });
    });
}